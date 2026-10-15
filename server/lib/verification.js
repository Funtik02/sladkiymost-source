const crypto = require('crypto')
const db = require('../db')
const HttpError = require('./httpError')
const mailer = require('./mailer')
const { nowISO } = require('./dates')
const { createSession, hashToken, normalizeEmail, pruneSessions, publicUser } = require('./users')

const CODE_TTL_MS = 30 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const SEND_WINDOW_MS = 60 * 60 * 1000
const MAX_SENDS_PER_WINDOW = 5
const MAX_CODE_ATTEMPTS = 5

const isVerified = (user) => user.emailVerified !== false

const hashCode = (userId, code) => hashToken(`${userId}:${code}`)

function sameHash(a, b) {
    const left = Buffer.from(String(a ?? ''), 'hex')
    const right = Buffer.from(String(b ?? ''), 'hex')
    return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right)
}

function secondsUntilResend(verification, now = Date.now()) {
    if (!verification?.sentAt) return 0
    return Math.max(0, Math.ceil((Date.parse(verification.sentAt) + RESEND_COOLDOWN_MS - now) / 1000))
}

function hasSentCode(user, now = Date.now()) {
    const v = user.verification
    return Boolean(v?.sentAt && Date.parse(v.expiresAt) > now && v.attempts < MAX_CODE_ATTEMPTS)
}

function pendingInfo(user, now = Date.now()) {
    return { email: user.email, resendAfter: secondsUntilResend(user.verification, now) }
}

function issueCode(user, now) {
    const previous = user.verification ?? {}
    const wait = secondsUntilResend(previous, now)
    if (wait > 0) throw new HttpError(429, `Новый код можно запросить через ${wait} с`, { resendAfter: wait })

    const sends = (previous.sends ?? []).filter((at) => now - Date.parse(at) < SEND_WINDOW_MS)
    if (sends.length >= MAX_SENDS_PER_WINDOW) throw new HttpError(429, 'Слишком много писем подряд. Попробуйте через час')

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
    const token = crypto.randomBytes(32).toString('hex')
    const sentAt = new Date(now).toISOString()

    user.verification = {
        codeHash: hashCode(user.id, code),
        tokenHash: hashToken(token),
        expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
        attempts: 0,
        sentAt,
        sends: [...sends, sentAt],
        previousSentAt: previous.sentAt ?? null,
    }

    return { code, token }
}

async function deliver(user, code, token) {
    const tokenHash = hashToken(token)

    try {
        await mailer.sendVerificationEmail({ user, code, token, idempotencyKey: `verify-${tokenHash.slice(0, 40)}` })
    } catch (error) {
        console.error(`Письмо с кодом для ${user.email} не отправлено: ${error.message}`)

        await db.transaction(async ({ read, write }) => {
            const users = await read('users')
            const v = users.find((u) => u.id === user.id)?.verification
            if (v?.tokenHash !== tokenHash) return
            v.sends = v.sends.filter((at) => at !== v.sentAt)
            v.sentAt = v.previousSentAt
            await write('users', users)
        })

        if (error.status === 422) throw new HttpError(422, 'Не получилось доставить письмо на этот адрес. Проверьте email')
        throw new HttpError(502, 'Не получилось отправить письмо. Попробуйте ещё раз через минуту')
    }
}

async function sendCode(userId) {
    const issued = await db.transaction(async ({ read, write }) => {
        const users = await read('users')
        const user = users.find((u) => u.id === userId)
        if (!user) throw new HttpError(404, 'Аккаунт не найден. Зарегистрируйтесь заново')
        if (isVerified(user)) throw new HttpError(409, 'Почта уже подтверждена — войдите', { code: 'already_verified' })

        const { code, token } = issueCode(user, Date.now())
        await write('users', users)
        return { user: { id: user.id, name: user.name, email: user.email }, code, token }
    })

    await deliver(issued.user, issued.code, issued.token)
    return { email: issued.user.email, resendAfter: RESEND_COOLDOWN_MS / 1000 }
}

async function resendByEmail(rawEmail) {
    const email = normalizeEmail(rawEmail)
    if (!email) throw new HttpError(400, 'Укажите email')

    const user = (await db.read('users')).find((u) => u.email === email)
    if (!user) throw new HttpError(404, 'Аккаунт с таким email не найден. Зарегистрируйтесь')

    return sendCode(user.id)
}

function findByToken(users, token, now) {
    const tokenHash = hashToken(String(token))
    const user = users.find((u) => u.verification && sameHash(u.verification.tokenHash, tokenHash))

    if (!user || Date.parse(user.verification.expiresAt) <= now) {
        throw new HttpError(400, 'Ссылка устарела или уже использована. Войдите — пришлём новый код', { code: 'link_invalid' })
    }

    return user
}

async function findByCode(users, rawEmail, rawCode, now, write) {
    const email = normalizeEmail(rawEmail)
    const code = String(rawCode ?? '').replace(/\D/g, '')
    if (code.length !== 6) throw new HttpError(400, 'Введите 6 цифр из письма')

    const user = users.find((u) => u.email === email)
    if (!user) throw new HttpError(404, 'Аккаунт с таким email не найден. Зарегистрируйтесь')
    if (isVerified(user)) throw new HttpError(409, 'Почта уже подтверждена — войдите', { code: 'already_verified' })

    const v = user.verification
    if (!v || Date.parse(v.expiresAt) <= now) throw new HttpError(400, 'Код устарел. Запросите новый', { code: 'code_expired' })
    if (v.attempts >= MAX_CODE_ATTEMPTS) {
        throw new HttpError(429, 'Слишком много неверных попыток. Запросите новый код', { code: 'code_expired' })
    }

    if (!sameHash(hashCode(user.id, code), v.codeHash)) {
        v.attempts += 1
        await write('users', users)
        const left = MAX_CODE_ATTEMPTS - v.attempts
        throw new HttpError(400, left > 0 ? `Неверный код. Осталось попыток: ${left}` : 'Неверный код. Попытки закончились — запросите новый код')
    }

    return user
}

function verifyEmail({ email, code, token }) {
    return db.transaction(async ({ read, write }) => {
        const [users, sessions] = await Promise.all([read('users'), read('sessions')])
        const now = Date.now()
        const user = token ? findByToken(users, token, now) : await findByCode(users, email, code, now, write)

        user.emailVerified = true
        user.emailVerifiedAt = nowISO()
        delete user.verification

        const active = pruneSessions(sessions)
        const sessionToken = createSession(active, user.id)

        await write('users', users)
        await write('sessions', active)

        return { token: sessionToken, user: publicUser(user) }
    })
}

module.exports = {
    isVerified,
    hasSentCode,
    pendingInfo,
    sendCode,
    resendByEmail,
    verifyEmail,
}
