const db = require('../db')
const { addDays, todayISO } = require('../lib/dates')
const { calcDelivery, isShelfLifeOk, roundTo } = require('../lib/delivery')
const { getMonthFromISO } = require('../lib/season')
const { buildOrder } = require('../lib/orders')
const { CUTOFF_DAYS_BEFORE, DIRECTIONS } = require('../lib/waves')

function mulberry32(seed) {
    let a = seed
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const rand = mulberry32(2026)
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (list) => list[Math.floor(rand() * list.length)]
const shuffle = (list) => [...list].sort(() => rand() - 0.5)
const pad = (n) => String(n).padStart(2, '0')

const at = (isoDate, hours, minutes = 0) => new Date(`${isoDate}T${pad(hours)}:${pad(minutes)}:00`).toISOString()

const T = todayISO()
const day = (offset) => addDays(T, offset)
const LAUNCH = at(day(-1), 9)

const BUYERS = {
    Донецк: {
        people: ['Ольга Ковальчук', 'Сергей Мельник', 'Ирина Бондаренко', 'Андрей Шевчук', 'Наталья Ткаченко', 'Виктор Гребенюк'],
        shops: ['Магазин «Сладкоежка»', 'Кофейня «Каштан»', 'Магазин «Северный гостинец»', 'Чайная «Терриконъ»'],
    },
    Якутск: {
        people: ['Сардана Иванова', 'Айаал Николаев', 'Туйаара Попова', 'Николай Егоров', 'Кюннэй Васильева', 'Мария Слепцова'],
        shops: ['Магазин «Южные сладости»', 'Кафе «Олонхо»', 'Супермаркет «Туймаада»', 'Кондитерская «Ленская»'],
    },
}

const CARD_TEXTS = [
    'С праздником! Пусть этот кусочек тепла дойдёт до тебя через всю страну.',
    'Обнимаю крепко-крепко! Попробуй — это вкус моего детства.',
    'Скучаем и ждём в гости. Сладкого настроения!',
]

const translit = (text) =>
    text.toLowerCase().replace(/[^a-zа-яё]/g, '').split('').map((ch) => ({
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
        м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
        щ: 'sh', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '',
    })[ch] ?? ch).join('').slice(0, 12)

const phone = () => `+79${pad(randInt(10, 99))}${randInt(1000000, 9999999)}`

function person(name) {
    return { name, phone: phone(), email: `${translit(name) || 'client'}${randInt(1, 99)}@example.com` }
}

const PLAN = [
    { key: 'ykt-1', direction: 'YKT_DNR', offset: 10, status: 'open', kg: 168 },
    { key: 'ykt-2', direction: 'YKT_DNR', offset: 24, status: 'open', kg: 46 },
    { key: 'ykt-3', direction: 'YKT_DNR', offset: 38, status: 'open', kg: 12 },
    { key: 'ykt-4', direction: 'YKT_DNR', offset: 52, status: 'open', kg: 0 },
    { key: 'dnr-closed', direction: 'DNR_YKT', offset: 3, status: 'closed', kg: 96 },
    { key: 'dnr-1', direction: 'DNR_YKT', offset: 17, status: 'open', kg: 228 },
    { key: 'dnr-2', direction: 'DNR_YKT', offset: 31, status: 'open', kg: 64 },
    { key: 'dnr-3', direction: 'DNR_YKT', offset: 45, status: 'open', kg: 0 },
    { key: 'dnr-4', direction: 'DNR_YKT', offset: 59, status: 'open', kg: 0 },
]

function makeWave(plan) {
    const departureDate = day(plan.offset)
    const createdAt = LAUNCH

    return {
        id: `${plan.direction}-${departureDate}`,
        direction: plan.direction,
        departureDate,
        cutoffDate: addDays(departureDate, -CUTOFF_DAYS_BEFORE),
        currentWeightKg: 0,
        maxWeightKg: 300,
        minWeightKg: 50,
        status: 'open',
        postponedFrom: [],
        mergedInto: null,
        createdAt,
        history: [{ at: createdAt, note: 'Волна создана автоматически по расписанию' }],
    }
}

function toLine(product, qty) {
    return {
        type: 'product',
        productId: product.id,
        name: product.name,
        region: product.region,
        manufacturer: product.manufacturer,
        weight_g: product.weight_g,
        price_rub: product.price_rub,
        temp_sensitive: product.temp_sensitive,
        shelf_life_days: product.shelf_life_days,
        direction: DIRECTIONS[product.region === 'Якутия' ? 'YKT_DNR' : 'DNR_YKT'].code,
        qty,
        lineTotal: product.price_rub * qty,
    }
}

const linesWeightKg = (lines) => lines.reduce((sum, l) => sum + l.weight_g * l.qty, 0) / 1000

const CLOSED_AT = at(T, 12, 40)

function orderWindow(wave) {
    return { from: at(day(-1), 9, 30), to: wave.cutoffDate <= T ? CLOSED_AT : at(day(1), 22) }
}

function randomMoment({ from, to }) {
    const start = new Date(from).getTime()
    const end = new Date(to).getTime()

    for (;;) {
        const moment = new Date(start + rand() * (end - start))
        const hour = moment.getHours()
        if (hour >= 8 && hour < 23 && (hour >= 10 || rand() < 0.4)) return moment.toISOString()
    }
}

function generateDrafts(wave, targetKg, products, pickupPoints) {
    const { fromRegion, toCity } = DIRECTIONS[wave.direction]
    const month = getMonthFromISO(wave.departureDate)
    const pool = products.filter((p) => p.region === fromRegion && isShelfLifeOk(p.shelf_life_days, month))
    const points = pickupPoints.filter((p) => p.city === toCity)
    const drafts = []
    let total = 0

    while (total < targetKg - 1.5) {
        const remaining = targetKg - total
        const wholesale = remaining > 8 && rand() < 0.8
        let lines = shuffle(pool)
            .slice(0, randInt(1, wholesale ? 3 : 4))
            .map((p) => toLine(p, wholesale ? randInt(12, 34) : randInt(1, 3)))

        const weight = linesWeightKg(lines)
        if (weight > remaining + 1) {
            const factor = remaining / weight
            lines = lines.map((l) => toLine(products.find((p) => p.id === l.productId), Math.max(1, Math.floor(l.qty * factor))))
            while (lines.length > 1 && linesWeightKg(lines) > remaining + 1) lines.pop()
            if (linesWeightKg(lines) > remaining + 1) break
        }

        total += linesWeightKg(lines)
        drafts.push({
            lines,
            createdAt: randomMoment(orderWindow(wave)),
            customer: person(wholesale ? pick(BUYERS[toCity].shops) : pick(BUYERS[toCity].people)),
            pickupPoint: pick(points),
            thermoChosen: rand() < 0.2,
        })
    }

    return drafts
}

function contactsFor(draft) {
    const gift = draft.gift ?? null

    return {
        scenario: gift ? 'gift' : 'self',
        customer: draft.customer,
        recipient: draft.recipient ?? null,
        gift,
        pickupPoint: draft.pickupPoint,
        payment: rand() < 0.75
            ? { method: 'card', label: 'Картой онлайн (имитация)', status: 'paid' }
            : { method: 'cash', label: 'При получении', status: 'on_delivery' },
    }
}

function giftBoxLine(products, ids, destination) {
    const contents = ids.map((id) => {
        const p = products.find((x) => x.id === id)
        return {
            productId: p.id,
            name: p.name,
            region: p.region,
            manufacturer: p.manufacturer,
            weight_g: p.weight_g,
            price_rub: p.price_rub,
            temp_sensitive: p.temp_sensitive,
            shelf_life_days: p.shelf_life_days,
        }
    })
    const price = contents.reduce((sum, c) => sum + c.price_rub, 0)

    return {
        type: 'giftBox',
        name: `Набор «Север + Юг» → ${destination}`,
        destination,
        direction: destination === 'Якутия' ? 'DNR_YKT' : 'YKT_DNR',
        contents,
        weight_g: contents.reduce((sum, c) => sum + c.weight_g, 0),
        price_rub: price,
        temp_sensitive: contents.some((c) => c.temp_sensitive),
        shelf_life_days: Math.min(...contents.map((c) => c.shelf_life_days)),
        qty: 1,
        lineTotal: price,
    }
}

const SHOWCASE_IDS = ['204817', '305522', '411093']

function nextId(orders) {
    let id
    do {
        id = String(randInt(100000, 999999))
    } while (SHOWCASE_IDS.includes(id) || orders.some((o) => o.id === id))
    return id
}

function setHistory(order, events) {
    order.statusHistory = [{ status: 'accepted', at: order.createdAt }, ...events]
    order.status = order.statusHistory[order.statusHistory.length - 1].status
}

async function main() {
    const [products, pickupPoints] = await Promise.all([db.read('products'), db.read('pickup-points')])
    const byKey = new Map(PLAN.map((plan) => [plan.key, { plan, wave: makeWave(plan) }]))
    const point = (id) => pickupPoints.find((p) => p.id === id)
    const product = (id) => products.find((p) => p.id === id)

    const showcase = {
        'ykt-1': [{
            id: '204817',
            lines: [toLine(product('YKT-001'), 2), toLine(product('YKT-006'), 3), toLine(product('YKT-014'), 4)],
            createdAt: at(day(-1), 14, 20),
            customer: person('Сардана Иванова'),
            recipient: { name: 'Ольга Ковальчук', phone: phone() },
            gift: { cardText: CARD_TEXTS[0], cardDesign: 'north', hidePrice: false },
            pickupPoint: point('DON-1'),
            thermoChosen: true,
        }],
        'dnr-closed': [{
            id: '305522',
            lines: [toLine(product('DNR-001'), 2), toLine(product('DNR-009'), 3)],
            createdAt: at(day(-1), 11, 5),
            customer: person('Айаал Николаев'),
            pickupPoint: point('YKS-1'),
            thermoChosen: false,
        }],
        'dnr-1': [{
            id: '411093',
            lines: [giftBoxLine(products, ['YKT-003', 'YKT-008', 'DNR-003', 'DNR-011'], 'Якутия')],
            createdAt: at(day(-1), 19, 40),
            customer: person('Наталья Ткаченко'),
            recipient: { name: 'Туйаара Попова', phone: phone() },
            gift: { cardText: CARD_TEXTS[1], cardDesign: 'bridge', hidePrice: true },
            pickupPoint: point('YKS-2'),
            thermoChosen: false,
        }],
    }

    const orders = []

    for (const { plan, wave } of byKey.values()) {
        const fixed = showcase[plan.key] ?? []
        const fixedKg = fixed.reduce((sum, d) => sum + linesWeightKg(d.lines), 0)
        const drafts = [...fixed, ...generateDrafts(wave, plan.kg - fixedKg, products, pickupPoints)]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        for (const draft of drafts) {
            const delivery = calcDelivery({ items: draft.lines, wave, thermoChosen: draft.thermoChosen })
            const goods = draft.lines.reduce((sum, l) => sum + l.lineTotal, 0)
            const quote = { direction: wave.direction, wave, lines: draft.lines, delivery, goods, total: goods + delivery.total }
            const order = buildOrder(quote, contactsFor(draft), orders, draft.thermoChosen)

            order.id = draft.id ?? nextId(orders)
            order.createdAt = draft.createdAt
            order.statusHistory = [{ status: 'accepted', at: draft.createdAt }]
            wave.currentWeightKg = delivery.waveWeightAfterKg
            orders.push(order)
        }
    }

    for (const { plan, wave } of byKey.values()) {
        const waveOrders = orders.filter((o) => o.waveId === wave.id)

        if (plan.status === 'closed') {
            const closedAt = CLOSED_AT
            wave.status = 'closed'
            wave.closedAt = closedAt
            wave.history.push({ at: closedAt, note: 'Приём закрыт администратором' })
            waveOrders.forEach((o) =>
                setHistory(o, [{ status: 'assembling', at: closedAt, note: 'Приём в волну закрыт, заказ собирается' }])
            )
        }
    }

    const waves = [...byKey.values()].map(({ wave }) => ({ ...wave, currentWeightKg: roundTo(wave.currentWeightKg, 3) }))

    await db.write('waves', waves)
    await db.write('orders', orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

    console.log(`Волн: ${waves.length}, заказов: ${orders.length}`)
    waves.forEach((w) => console.log(`  ${w.id.padEnd(22)} ${w.status.padEnd(9)} ${w.currentWeightKg} кг`))
    console.log('Демо-заказы: 204817 (подарок с открыткой), 305522 (в сборке), 411093 (набор «Север + Юг», цены скрыты)')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
