const rubFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatRub(value) {
    return `${rubFormat.format(Math.round(value))} ₽`
}

export function formatKg(kg) {
    const digits = kg < 10 ? 2 : 1
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(kg)} кг`
}

export function formatWeight(grams) {
    return grams < 1000 ? `${grams} г` : formatKg(grams / 1000)
}

export function formatPercent(ratio) {
    return `${Math.round(ratio * 100)} %`
}

export function pricePer100g(priceRub, weightG) {
    return formatRub((priceRub / weightG) * 100)
}

export function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}

export function todayISO() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

export function formatDate(iso, { withYear = false, withWeekday = false } = {}) {
    const date = parseISODate(iso)
    const showYear = withYear || date.getFullYear() !== new Date().getFullYear()
    const text = (showYear ? dayMonthYear : dayMonth).format(date).replace(' г.', '')

    return withWeekday ? `${text}, ${weekday.format(date)}` : text
}

export function formatDateRange(fromISO, toISO) {
    const from = parseISODate(fromISO)
    const to = parseISODate(toISO)

    if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
        return `${from.getDate()}–${formatDate(toISO)}`
    }

    return `${formatDate(fromISO)} – ${formatDate(toISO)}`
}

const dateTime = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
})

export function formatDateTime(isoDateTime) {
    return dateTime.format(new Date(isoDateTime))
}

export function pluralize(n, [one, few, many]) {
    const mod10 = n % 10
    const mod100 = n % 100

    if (mod10 === 1 && mod100 !== 11) return one
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
    return many
}

const IMAGES_VERSION = 4

export function photoUrl(photo) {
    if (!photo) return ''
    return /^https?:\/\//i.test(photo) ? photo : `/images/${photo}?v=${IMAGES_VERSION}`
}
