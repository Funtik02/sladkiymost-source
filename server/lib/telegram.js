const API_URL = 'https://api.telegram.org'
const REQUEST_TIMEOUT_MS = 10000
const SEND_INTERVAL_MS = 1100
const MAX_ATTEMPTS = 3
const DETAILED_LIMIT = 3

const waves = () => require('./waves')

function config() {
    return {
        token: (process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
        chatIds: (process.env.TELEGRAM_CHAT_ID ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        siteUrl: (process.env.SITE_URL || 'http://localhost:5173').replace(/\/+$/, ''),
        timeZone: process.env.TELEGRAM_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
}

function isEnabled() {
    const { token, chatIds } = config()
    return Boolean(token && chatIds.length > 0)
}

async function callApi(method, body = {}, token = config().token) {
    const response = await fetch(`${API_URL}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const data = await response.json().catch(() => ({}))

    if (!data.ok) {
        const error = new Error(data.description || `HTTP ${response.status}`)
        error.retryAfter = data.parameters?.retry_after
        throw error
    }

    return data.result
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function deliver(chatId, text, attempt = 1) {
    try {
        await callApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
    } catch (error) {
        if (attempt < MAX_ATTEMPTS && (error.retryAfter || error.name === 'TimeoutError')) {
            await sleep((error.retryAfter ?? 2) * 1000)
            return deliver(chatId, text, attempt + 1)
        }
        console.warn(`Telegram: сообщение не отправлено в чат ${chatId} — ${error.message}. Повторить уведомление о заказе: npm run telegram -- <номер заказа>`)
    }
}

let queue = Promise.resolve()

function send(text) {
    for (const chatId of config().chatIds) {
        queue = queue.then(() => deliver(chatId, text)).then(() => sleep(SEND_INTERVAL_MS))
    }
    return queue
}

const escapeHtml = (value) =>
    String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const rub = (value) => `${Math.round(value).toLocaleString('ru-RU')} ₽`
const kg = (value) => `${String(Math.round(value * 100) / 100).replace('.', ',')} кг`
const date = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '—')

function dateTime(iso) {
    return new Date(iso).toLocaleString('ru-RU', {
        timeZone: config().timeZone,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

const statusLabel = (status) => waves().ORDER_STATUS_LABELS[status] ?? status
const directionLabel = (direction) => waves().DIRECTIONS[direction]?.label ?? direction
const orderLink = (order) => `<a href="${escapeHtml(`${config().siteUrl}/order/${order.id}`)}">Открыть заказ на сайте</a>`
const phone = (value) => String(value ?? '').replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 $1 $2-$3-$4')
const person = (p) => [p.name, phone(p.phone), p.email].filter(Boolean).map(escapeHtml).join(', ')

function ordersCount(n) {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return `${n} заказ`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} заказа`
    return `${n} заказов`
}

function waveLine(order, wave) {
    if (!wave) return `Волна: ${escapeHtml(directionLabel(order.direction))}`
    return `Волна: ${escapeHtml(directionLabel(wave.direction))}, отправка ${date(wave.departureDate)}, приём до ${date(wave.cutoffDate)}`
}

function itemLines(item) {
    const total = item.lineTotal ?? item.price_rub * item.qty
    const line = `• ${escapeHtml(item.name)} × ${item.qty} — ${rub(total)}`
    if (item.type !== 'giftBox' || !Array.isArray(item.contents)) return [line]
    return [line, ...item.contents.map((c) => `    – ${escapeHtml(c.name)}`)]
}

function newOrderMessage(order, wave) {
    const { delivery } = order.totals
    const extras = [
        delivery.discount > 0 ? `скидка ${Math.round(delivery.discount * 100)} %` : null,
        delivery.thermoApplied ? `термоупаковка ${rub(delivery.thermoCost)}` : null,
    ].filter(Boolean)
    const point = order.pickupPoint

    return [
        `🆕 <b>Новый заказ №${order.id}</b>${order.scenario === 'gift' ? ' · подарок' : ''}`,
        `Создан: ${dateTime(order.createdAt)}`,
        '',
        `${order.scenario === 'gift' ? 'Отправитель' : 'Покупатель'}: ${person(order.customer)}`,
        order.recipient ? `Получатель: ${person(order.recipient)}` : null,
        '',
        '<b>Состав:</b>',
        ...order.items.flatMap(itemLines),
        '',
        `Вес: ${kg(order.totals.weightKg)}`,
        `Товары: ${rub(order.totals.goods)}`,
        `Доставка: ${rub(delivery.total)}${extras.length ? ` (${extras.join(', ')})` : ''}`,
        `<b>Итого: ${rub(order.totals.total)}</b>`,
        `Оплата: ${escapeHtml(order.payment.label)}${order.payment.status === 'paid' ? ' — оплачен' : ''}`,
        '',
        waveLine(order, wave),
        point ? `Пункт выдачи: ${escapeHtml(`${point.name}, ${point.address}, ${point.city}`)}` : null,
        order.gift?.cardText ? `Открытка: «${escapeHtml(order.gift.cardText)}»` : null,
        '',
        orderLink(order),
    ]
        .filter((line) => line !== null)
        .join('\n')
}

function statusMessage(order, wave, fromStatus) {
    const note = order.statusHistory.at(-1)?.note

    return [
        `🔄 <b>Заказ №${order.id}: ${statusLabel(fromStatus)} → ${statusLabel(order.status)}</b>`,
        `${order.scenario === 'gift' ? 'Отправитель' : 'Покупатель'}: ${person(order.customer)}`,
        waveLine(order, wave),
        `Сумма: ${rub(order.totals.total)}`,
        note ? `Комментарий: ${escapeHtml(note)}` : null,
        '',
        orderLink(order),
    ]
        .filter((line) => line !== null)
        .join('\n')
}

function statusSummaryMessage(group, wave) {
    const { fromStatus, toStatus, orders } = group
    const note = orders[0].statusHistory.at(-1)?.note

    return [
        `🔄 <b>${ordersCount(orders.length)}: ${statusLabel(fromStatus)} → ${statusLabel(toStatus)}</b>`,
        waveLine(orders[0], wave),
        note ? `Комментарий: ${escapeHtml(note)}` : null,
        `Заказы: ${orders.map((o) => `№${o.id}`).join(', ')}`,
    ]
        .filter((line) => line !== null)
        .join('\n')
}

function postponeMessage(group) {
    const { postponement, orders, direction } = group

    return [
        `⏭ <b>Волна перенесена: ${date(postponement.from)} → ${date(postponement.to)}</b>`,
        `Направление: ${escapeHtml(directionLabel(direction))}`,
        `Причина: ${escapeHtml(postponement.reason)}`,
        `Заказы (${orders.length}): ${orders.map((o) => `№${o.id}`).join(', ')}`,
    ].join('\n')
}

function snapshotOrders(orders) {
    return new Map(orders.map((o) => [o.id, { status: o.status, postponements: o.postponements.length }]))
}

function collectChanges(before, orders) {
    const created = []
    const statusGroups = new Map()
    const postponeGroups = new Map()

    for (const order of orders) {
        const previous = before.get(order.id)

        if (!previous) {
            created.push(order)
            continue
        }

        if (previous.status !== order.status) {
            const key = `${order.waveId}|${previous.status}|${order.status}`
            const group = statusGroups.get(key) ?? { fromStatus: previous.status, toStatus: order.status, waveId: order.waveId, orders: [] }
            group.orders.push(order)
            statusGroups.set(key, group)
        }

        for (const postponement of order.postponements.slice(previous.postponements)) {
            const key = `${order.direction}|${postponement.from}|${postponement.to}|${postponement.at}`
            const group = postponeGroups.get(key) ?? { postponement, direction: order.direction, orders: [] }
            group.orders.push(order)
            postponeGroups.set(key, group)
        }
    }

    return { created, statusGroups: [...statusGroups.values()], postponeGroups: [...postponeGroups.values()] }
}

function notifyOrderChanges(before, orders, waveList) {
    if (!isEnabled() || !before) return

    const findWave = (id) => waveList.find((w) => w.id === id)
    const { created, statusGroups, postponeGroups } = collectChanges(before, orders)

    created.forEach((order) => send(newOrderMessage(order, findWave(order.waveId))))
    postponeGroups.forEach((group) => send(postponeMessage(group)))
    statusGroups.forEach((group) => {
        const wave = findWave(group.waveId)
        if (group.orders.length <= DETAILED_LIMIT) {
            group.orders.forEach((order) => send(statusMessage(order, wave, group.fromStatus)))
        } else {
            send(statusSummaryMessage(group, wave))
        }
    })
}

module.exports = {
    config,
    isEnabled,
    callApi,
    send,
    snapshotOrders,
    collectChanges,
    notifyOrderChanges,
    newOrderMessage,
    statusMessage,
}
