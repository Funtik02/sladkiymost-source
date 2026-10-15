const crypto = require('crypto')
const { promisify } = require('util')
const HttpError = require('./httpError')
const { nowISO } = require('./dates')

const scrypt = promisify(crypto.scrypt)

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128
const KEY_LENGTH = 64
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = 8

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+7\d{10}$/

const failures = new Map()

function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase()
}

function normalizePhone(value) {
    const compact = String(value ?? '').replace(/[\s()-]/g, '')
    if (/^8\d{10}$/.test(compact)) return `+7${compact.slice(1)}`
    if (/^9\d{9}$/.test(compact)) return `+7${compact}`
    if (/^7\d{10}$/.test(compact)) return `+${compact}`
    return compact
}

function validateRegistration(body) {
    const name = String(body?.name ?? '').trim()
    const email = normalizeEmail(body?.email)
    const phone = String(body?.phone ?? '').trim() ? normalizePhone(body.phone) : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (name.length < 2 || name.length > 80) throw new HttpError(400, 'Имя — от 2 до 80 символов')
    if (!EMAIL_RE.test(email) || email.length > 120) throw new HttpError(400, 'Проверьте email: пример — name@mail.ru')
    if (phone && !PHONE_RE.test(phone)) throw new HttpError(400, 'Телефон в формате +7 XXX XXX-XX-XX')
    if (password.length < PASSWORD_MIN) throw new HttpError(400, `Пароль — не короче ${PASSWORD_MIN} символов`)
    if (password.length > PASSWORD_MAX) throw new HttpError(400, `Пароль — не длиннее ${PASSWORD_MAX} символов`)

    return { name, email, phone, password }
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const key = await scrypt(password, salt, KEY_LENGTH)
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

async function verifyPassword(password, stored) {
    const [scheme, saltHex, keyHex] = String(stored ?? '').split('$')
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false

    const expected = Buffer.from(keyHex, 'hex')
    const actual = await scrypt(String(password ?? ''), Buffer.from(saltHex, 'hex'), expected.length)
    return crypto.timingSafeEqual(actual, expected)
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

function createSession(sessions, userId) {
    const token = crypto.randomBytes(32).toString('hex')
    const now = Date.now()

    sessions.push({
        tokenHash: hashToken(token),
        userId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    })

    return token
}

function pruneSessions(sessions) {
    const now = new Date().toISOString()
    return sessions.filter((s) => s.expiresAt > now)
}

function readToken(req) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '')
    return match ? match[1] : null
}

function findSession(sessions, token) {
    if (!token) return null
    const tokenHash = hashToken(token)
    const now = new Date().toISOString()
    return sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > now) ?? null
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt }
}

function newUser({ name, email, phone }, passwordHash) {
    return { id: `u_${crypto.randomUUID()}`, name, email, phone, passwordHash, createdAt: nowISO() }
}

function loginKey(req, email) {
    return `${req.ip}|${email}`
}

function assertLoginAllowed(req, email) {
    const entry = failures.get(loginKey(req, email))
    if (entry && entry.count >= LOGIN_MAX_FAILURES && Date.now() - entry.since < LOGIN_WINDOW_MS) {
        throw new HttpError(429, 'Слишком много попыток входа. Попробуйте через 15 минут')
    }
}

function registerLoginFailure(req, email) {
    const key = loginKey(req, email)
    const entry = failures.get(key)
    if (!entry || Date.now() - entry.since >= LOGIN_WINDOW_MS) failures.set(key, { count: 1, since: Date.now() })
    else entry.count += 1
}

function clearLoginFailures(req, email) {
    failures.delete(loginKey(req, email))
}

module.exports = {
    normalizeEmail,
    validateRegistration,
    hashPassword,
    verifyPassword,
    createSession,
    pruneSessions,
    readToken,
    findSession,
    hashToken,
    publicUser,
    newUser,
    assertLoginAllowed,
    registerLoginFailure,
    clearLoginFailures,
}
