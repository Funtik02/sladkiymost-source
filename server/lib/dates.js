const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n) => String(n).padStart(2, '0')

function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function todayISO() {
    return toISODate(new Date())
}

function nowISO() {
    return new Date().toISOString()
}

function isValidISODate(value) {
    const match = ISO_DATE.exec(String(value))
    if (!match) return false

    const [, y, m, d] = match.map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))

    return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
    )
}

function addDays(iso, days) {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + days))

    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

module.exports = {
    todayISO,
    nowISO,
    isValidISODate,
    addDays,
}
