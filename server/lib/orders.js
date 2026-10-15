const crypto = require('crypto')
const HttpError = require('./httpError')
const { nowISO, addDays } = require('./dates')
const { getMonthFromISO } = require('./season')
const { REGIONS } = require('./products')
const {
    calcDelivery,
    getDeliveryDays,
    getRequiredShelfLifeDays,
    isShelfLifeOk,
} = require('./delivery')
const {
    DIRECTIONS,
    ORDER_STATUS_LABELS,
    directionFromRegion,
    directionToRegion,
    isAccepting,
    publicWave,
} = require('./waves')

const MAX_LINES = 30
const MAX_QTY = 99
const GIFT_BOX_MAX_ITEMS = 6
const CARD_TEXT_MAX = 300
const CARD_DESIGNS = ['north', 'south', 'bridge']
const PAYMENT_METHODS = {
    card: 'Картой онлайн (имитация)',
    cash: 'При получении',
}

const PHONE_RE = /^\+7\d{10}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const formatDate = (iso) => iso.split('-').reverse().join('.')

function normalizePhone(value) {
    return String(value ?? '').replace(/[\s()-]/g, '')
}

function parseQty(value) {
    const qty = Number(value)
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        throw new HttpError(400, `Количество должно быть целым числом от 1 до ${MAX_QTY}`)
    }
    return qty
}

function snapshot(product) {
    return {
        productId: product.id,
        name: product.name,
        region: product.region,
        manufacturer: product.manufacturer,
        weight_g: product.weight_g,
        price_rub: product.price_rub,
        temp_sensitive: product.temp_sensitive,
        shelf_life_days: product.shelf_life_days,
    }
}

function resolveLines(rawItems, products) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new HttpError(400, 'Корзина пуста')
    }
    if (rawItems.length > MAX_LINES) {
        throw new HttpError(400, `В заказе не больше ${MAX_LINES} позиций`)
    }

    const byId = new Map(products.map((p) => [p.id, p]))
    const findProduct = (id) => {
        const product = byId.get(id)
        if (!product) throw new HttpError(400, `Товар ${id} больше не продаётся. Обновите корзину`)
        return product
    }

    const lines = rawItems.map((raw) => {
        const qty = parseQty(raw?.qty)

        if (raw.type === 'giftBox') {
            const ids = Array.isArray(raw.productIds) ? [...new Set(raw.productIds.map(String))] : []

            if (ids.length < 2 || ids.length > GIFT_BOX_MAX_ITEMS) {
                throw new HttpError(400, `В наборе «Север + Юг» от 2 до ${GIFT_BOX_MAX_ITEMS} позиций`)
            }
            if (!REGIONS.includes(raw.destination)) {
                throw new HttpError(400, 'Укажите регион назначения набора')
            }

            const contents = ids.map((id) => snapshot(findProduct(id)))

            if (!REGIONS.every((region) => contents.some((c) => c.region === region))) {
                throw new HttpError(400, 'В наборе должен быть хотя бы один товар из Якутии и один из ДНР')
            }

            const price = contents.reduce((sum, c) => sum + c.price_rub, 0)

            return {
                type: 'giftBox',
                name: `Набор «Север + Юг» → ${raw.destination}`,
                destination: raw.destination,
                direction: directionToRegion(raw.destination),
                contents,
                weight_g: contents.reduce((sum, c) => sum + c.weight_g, 0),
                price_rub: price,
                temp_sensitive: contents.some((c) => c.temp_sensitive),
                shelf_life_days: Math.min(...contents.map((c) => c.shelf_life_days)),
                qty,
                lineTotal: price * qty,
            }
        }

        const product = findProduct(String(raw.productId))

        return {
            type: 'product',
            ...snapshot(product),
            direction: directionFromRegion(product.region),
            qty,
            lineTotal: product.price_rub * qty,
        }
    })

    const directions = new Set(lines.map((l) => l.direction))
    if (directions.size > 1) {
        throw new HttpError(400, 'В заказе товары, которые едут разными волнами. Оформите их отдельными заказами')
    }

    return { lines, direction: lines[0].direction }
}

function quoteOrder(payload, { products, waves }) {
    const { lines, direction } = resolveLines(payload?.items, products)

    const wave = waves.find((w) => w.id === payload.waveId)
    if (!wave) throw new HttpError(400, 'Выберите волну отправки')
    if (wave.direction !== direction) {
        throw new HttpError(400, `Волна ${wave.id} идёт в другом направлении`)
    }
    if (!isAccepting(wave)) {
        throw new HttpError(409, `Приём заказов в волну от ${formatDate(wave.departureDate)} закрыт. Выберите другую волну`)
    }

    const month = getMonthFromISO(wave.departureDate)
    const expiring = lines.find((l) => !isShelfLifeOk(l.shelf_life_days, month))
    if (expiring) {
        throw new HttpError(
            409,
            `Срок годности в позиции «${expiring.name}» (${expiring.shelf_life_days} дн.) слишком мал для волны от ${formatDate(wave.departureDate)}: нужно не меньше ${getRequiredShelfLifeDays(month)} дн.`
        )
    }

    const delivery = calcDelivery({ items: lines, wave, thermoChosen: payload.thermoChosen === true })
    if (!delivery.fits) {
        throw new HttpError(
            409,
            `Заказ (${delivery.weightKg} кг) не помещается в волну от ${formatDate(wave.departureDate)}: свободно ${delivery.freeCapacityKg} кг`
        )
    }

    const goods = lines.reduce((sum, l) => sum + l.lineTotal, 0)
    const total = goods + delivery.total

    const clientTotal = Number(payload.clientTotal)
    if (Number.isFinite(clientTotal) && total > clientTotal) {
        throw new HttpError(409, `Стоимость заказа изменилась: ${total} ₽ вместо ${clientTotal} ₽. Проверьте корзину`)
    }

    return { lines, direction, wave, delivery, goods, total }
}

function validatePerson(person, label, { withEmail }) {
    const name = typeof person?.name === 'string' ? person.name.trim() : ''
    const phone = normalizePhone(person?.phone)
    const email = typeof person?.email === 'string' ? person.email.trim() : ''

    if (name.length < 2 || name.length > 80) throw new HttpError(400, `${label}: укажите имя (от 2 до 80 символов)`)
    if (!PHONE_RE.test(phone)) throw new HttpError(400, `${label}: телефон в формате +7XXXXXXXXXX`)
    if (withEmail && (!EMAIL_RE.test(email) || email.length > 120)) {
        throw new HttpError(400, `${label}: укажите корректный email`)
    }

    return withEmail ? { name, phone, email } : { name, phone }
}

function validateContacts(payload, direction, pickupPoints) {
    const { scenario } = payload
    if (scenario !== 'self' && scenario !== 'gift') {
        throw new HttpError(400, 'Выберите сценарий: заказ себе или подарок')
    }

    const customer = validatePerson(payload.customer, scenario === 'gift' ? 'Отправитель' : 'Покупатель', {
        withEmail: true,
    })

    const city = DIRECTIONS[direction].toCity
    const pickupPoint = pickupPoints.find((p) => p.id === payload.pickupPointId)
    if (!pickupPoint || pickupPoint.city !== city) {
        throw new HttpError(400, `Выберите пункт выдачи в городе ${city}`)
    }

    let recipient = null
    let gift = null

    if (scenario === 'gift') {
        recipient = validatePerson(payload.recipient, 'Получатель', { withEmail: false })

        const cardText = typeof payload.gift?.cardText === 'string' ? payload.gift.cardText.trim() : ''
        if (cardText.length > CARD_TEXT_MAX) {
            throw new HttpError(400, `Текст открытки — не больше ${CARD_TEXT_MAX} символов`)
        }

        const cardDesign = payload.gift?.cardDesign
        if (!CARD_DESIGNS.includes(cardDesign)) throw new HttpError(400, 'Выберите дизайн открытки')

        gift = { cardText, cardDesign, hidePrice: payload.gift?.hidePrice === true }
    }

    if (!PAYMENT_METHODS[payload.paymentMethod]) {
        throw new HttpError(400, 'Выберите способ оплаты')
    }

    if (payload.personalDataConsent !== true) {
        throw new HttpError(400, 'Без согласия на обработку персональных данных заказ не оформить')
    }

    return {
        scenario,
        customer,
        recipient,
        gift,
        pickupPoint,
        payment: {
            method: payload.paymentMethod,
            label: PAYMENT_METHODS[payload.paymentMethod],
            status: payload.paymentMethod === 'card' ? 'paid' : 'on_delivery',
        },
        personalDataConsent: { given: true, at: nowISO() },
    }
}

function generateOrderId(orders) {
    const taken = new Set(orders.map((o) => o.id))
    let id

    do {
        id = String(crypto.randomInt(100000, 1000000))
    } while (taken.has(id))

    return id
}

function buildOrder(quote, contacts, orders, thermoChosen) {
    const at = nowISO()
    const { delivery } = quote

    return {
        id: generateOrderId(orders),
        createdAt: at,
        direction: quote.direction,
        waveId: quote.wave.id,
        ...contacts,
        items: quote.lines.map(({ direction, ...line }) => line),
        thermoChosen: thermoChosen === true,
        totals: {
            goods: quote.goods,
            weightKg: delivery.weightKg,
            delivery: {
                tariffPerKg: delivery.tariffPerKg,
                baseCost: delivery.baseCost,
                waveWeightAfterKg: delivery.waveWeightAfterKg,
                fillPercent: delivery.fillPercent,
                discount: delivery.discount,
                discountAmount: delivery.discountAmount,
                thermoRequired: delivery.thermoRequired,
                thermoApplied: delivery.thermoApplied,
                thermoCost: delivery.thermoCost,
                total: delivery.total,
            },
            total: quote.total,
        },
        status: 'accepted',
        statusHistory: [{ status: 'accepted', at }],
        postponements: [],
    }
}

function expectedArrival(wave) {
    const days = getDeliveryDays(getMonthFromISO(wave.departureDate))
    return {
        from: addDays(wave.departureDate, days.min),
        to: addDays(wave.departureDate, days.max),
    }
}

function withWave(order, waves) {
    const wave = waves.find((w) => w.id === order.waveId)

    return {
        ...order,
        statusLabel: ORDER_STATUS_LABELS[order.status],
        wave: wave ? publicWave(wave) : null,
        expectedArrival: wave ? expectedArrival(wave) : null,
    }
}

function maskPhone(phone) {
    return phone.length > 4 ? `${phone.slice(0, 2)} *** ***-${phone.slice(-4, -2)}-${phone.slice(-2)}` : phone
}

function maskEmail(email) {
    const [user, domain] = email.split('@')
    return `${user.slice(0, 1)}***@${domain}`
}

function publicOrder(order, waves) {
    const { userId, personalDataConsent, ...rest } = order
    const view = withWave(rest, waves)

    view.customer = {
        name: order.customer.name,
        phone: maskPhone(order.customer.phone),
        email: maskEmail(order.customer.email),
    }
    if (order.recipient) {
        view.recipient = { name: order.recipient.name, phone: maskPhone(order.recipient.phone) }
    }

    if (order.gift?.hidePrice) {
        view.pricesHidden = true
        view.totals = { weightKg: order.totals.weightKg }
        view.items = order.items.map(({ price_rub, lineTotal, ...item }) => ({
            ...item,
            ...(item.contents
                ? { contents: item.contents.map(({ price_rub: _price, ...content }) => content) }
                : {}),
        }))
    }

    return view
}

module.exports = {
    quoteOrder,
    validateContacts,
    buildOrder,
    withWave,
    publicOrder,
}
