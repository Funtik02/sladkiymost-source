const crypto = require('crypto')
const HttpError = require('./httpError')

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = 5

const tokens = new Map()
const failures = new Map()

const isProduction = process.env.NODE_ENV === 'production'

function getAdminPassword() {
    return process.env.ADMIN_PASSWORD || (isProduction ? null : 'admin')
}

function safeEqual(a, b) {
    const hash = (value) => crypto.createHash('sha256').update(String(value)).digest()
    return crypto.timingSafeEqual(hash(a), hash(b))
}

function activeFailures(ip, now = Date.now()) {
    const entry = failures.get(ip)
    if (entry && now - entry.since >= LOGIN_WINDOW_MS) {
        failures.delete(ip)
        return null
    }
    return entry ?? null
}

function assertLoginAllowed(ip) {
    const entry = activeFailures(ip)
    if (!entry || entry.count < LOGIN_MAX_FAILURES) return

    const minutes = Math.ceil((entry.since + LOGIN_WINDOW_MS - Date.now()) / 60000)
    throw new HttpError(429, `Слишком много неверных попыток. Вход закрыт ещё на ${minutes} мин`)
}

function registerLoginFailure(ip) {
    const now = Date.now()
    if (failures.size > 10000) failures.forEach((_, key) => activeFailures(key, now))

    const entry = activeFailures(ip, now)
    if (entry) entry.count += 1
    else failures.set(ip, { count: 1, since: now })

    return LOGIN_MAX_FAILURES - failures.get(ip).count
}

function clearLoginFailures(ip) {
    failures.delete(ip)
}

function login(password) {
    const expected = getAdminPassword()
    if (typeof password !== 'string' || !expected || !safeEqual(password, expected)) {
        return null
    }

    const token = crypto.randomBytes(32).toString('hex')
    tokens.set(token, Date.now() + TOKEN_TTL_MS)

    return token
}

function logout(token) {
    tokens.delete(token)
}

function requireAdmin(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '')
    const token = match ? match[1] : null
    const expiresAt = token ? tokens.get(token) : undefined

    if (!token) {
        return next(new HttpError(401, 'Требуется вход администратора'))
    }

    if (!expiresAt || expiresAt < Date.now()) {
        tokens.delete(token)
        return next(new HttpError(401, 'Сессия администратора истекла. Войдите снова'))
    }

    req.adminToken = token
    next()
}

module.exports = {
    getAdminPassword,
    assertLoginAllowed,
    registerLoginFailure,
    clearLoginFailures,
    login,
    logout,
    requireAdmin,
}
