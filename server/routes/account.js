const express = require('express')
const db = require('../db')
const HttpError = require('../lib/httpError')
const { withWave } = require('../lib/orders')
const {
    assertLoginAllowed,
    clearLoginFailures,
    createSession,
    findSession,
    hashPassword,
    hashToken,
    newUser,
    normalizeEmail,
    pruneSessions,
    publicUser,
    readToken,
    registerLoginFailure,
    validateRegistration,
    verifyPassword,
} = require('../lib/users')
const { hasSentCode, isVerified, pendingInfo, resendByEmail, sendCode, verifyEmail } = require('../lib/verification')
const { withSyncedState } = require('../lib/waves')

const router = express.Router()

const MAX_CART_ITEMS = 50
const MAX_CART_BYTES = 60000
const EMPTY_CART = { items: [], direction: null, waveId: null, thermoChosen: false, consent: false }

function validateCart(body) {
    const cart = body?.cart
    if (!cart || typeof cart !== 'object' || !Array.isArray(cart.items)) throw new HttpError(400, 'Некорректная корзина')
    if (cart.items.length > MAX_CART_ITEMS) throw new HttpError(400, `В корзине — не больше ${MAX_CART_ITEMS} позиций`)
    if (!cart.items.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
        throw new HttpError(400, 'Некорректная корзина')
    }

    const clean = {
        items: cart.items,
        direction: typeof cart.direction === 'string' ? cart.direction.slice(0, 20) : null,
        waveId: typeof cart.waveId === 'string' ? cart.waveId.slice(0, 60) : null,
        thermoChosen: cart.thermoChosen === true,
        consent: cart.consent === true,
    }

    if (Buffer.byteLength(JSON.stringify(clean)) > MAX_CART_BYTES) throw new HttpError(413, 'Корзина слишком большая')
    return clean
}

async function resolveUser(req) {
    const token = readToken(req)
    if (!token) return null

    const [sessions, users] = await Promise.all([db.read('sessions'), db.read('users')])
    const session = findSession(sessions, token)
    return session ? users.find((u) => u.id === session.userId) ?? null : null
}

async function requireUser(req, res, next) {
    try {
        const user = await resolveUser(req)
        if (!user) throw new HttpError(401, 'Войдите в личный кабинет')
        req.user = user
        next()
    } catch (error) {
        next(error)
    }
}

router.post('/auth/register', async (req, res) => {
    const data = validateRegistration(req.body)
    const passwordHash = await hashPassword(data.password)

    const { pending, userId } = await db.transaction(async ({ read, write }) => {
        const users = await read('users')
        const existing = users.find((u) => u.email === data.email)

        if (existing && isVerified(existing)) {
            throw new HttpError(409, 'Аккаунт с таким email уже есть. Войдите или используйте другой email')
        }

        if (existing && hasSentCode(existing)) return { pending: pendingInfo(existing) }

        const user = existing ?? { ...newUser(data, passwordHash), emailVerified: false }
        if (existing) Object.assign(existing, { name: data.name, phone: data.phone, passwordHash })
        else users.push(user)

        await write('users', users)
        return { userId: user.id }
    })

    res.status(201).json({ verification: pending ?? (await sendCode(userId)) })
})

router.post('/auth/verify-email', async (req, res) => {
    const { email, code, token } = req.body ?? {}
    if (!token && !email) throw new HttpError(400, 'Укажите email и код из письма')

    res.json(await verifyEmail({ email, code, token: typeof token === 'string' ? token : undefined }))
})

router.post('/auth/resend-code', async (req, res) => {
    res.json({ verification: await resendByEmail(req.body?.email) })
})

router.post('/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!email || !password) throw new HttpError(400, 'Введите email и пароль')
    assertLoginAllowed(req, email)

    const users = await db.read('users')
    const user = users.find((u) => u.email === email)
    const valid = user ? await verifyPassword(password, user.passwordHash) : false

    if (!valid) {
        registerLoginFailure(req, email)
        await new Promise((resolve) => setTimeout(resolve, 400))
        throw new HttpError(401, 'Неверный email или пароль')
    }

    clearLoginFailures(req, email)

    if (!isVerified(user)) {
        let info = pendingInfo(user)
        if (!hasSentCode(user)) info = await sendCode(user.id).catch(() => info)
        throw new HttpError(403, 'Подтвердите почту: введите код из письма', { code: 'email_not_verified', verification: info })
    }

    const token = await db.transaction(async ({ read, write }) => {
        const sessions = pruneSessions(await read('sessions'))
        const created = createSession(sessions, user.id)
        await write('sessions', sessions)
        return created
    })

    res.json({ token, user: publicUser(user) })
})

router.post('/auth/logout', async (req, res) => {
    const token = readToken(req)

    if (token) {
        const tokenHash = hashToken(token)
        await db.transaction(async ({ read, write }) => {
            const sessions = await read('sessions')
            await write('sessions', sessions.filter((s) => s.tokenHash !== tokenHash))
        })
    }

    res.json({ ok: true })
})

router.get('/auth/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user) })
})

router.get('/account/orders', requireUser, async (req, res) => {
    const { waves, orders } = await withSyncedState()

    res.json(
        orders
            .filter((order) => order.userId === req.user.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((order) => withWave(order, waves))
    )
})

router.get('/account/cart', requireUser, async (req, res) => {
    const carts = await db.read('carts')
    res.json({ cart: carts.find((c) => c.userId === req.user.id)?.cart ?? EMPTY_CART })
})

router.put('/account/cart', requireUser, async (req, res) => {
    const cart = validateCart(req.body)

    await db.transaction(async ({ read, write }) => {
        const carts = await read('carts')
        const entry = { userId: req.user.id, cart, updatedAt: new Date().toISOString() }
        const index = carts.findIndex((c) => c.userId === req.user.id)
        if (index >= 0) carts[index] = entry
        else carts.push(entry)
        await write('carts', carts)
    })

    res.json({ cart })
})

module.exports = { router, resolveUser }
