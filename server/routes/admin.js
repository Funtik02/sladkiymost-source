const express = require('express')
const db = require('../db')
const HttpError = require('../lib/httpError')
const { assertLoginAllowed, clearLoginFailures, login, logout, registerLoginFailure, requireAdmin } = require('../lib/auth')
const { addDays, isValidISODate, nowISO, todayISO } = require('../lib/dates')
const { nextProductId, validateProduct } = require('../lib/products')
const { withWave } = require('../lib/orders')
const {
    CUTOFF_DAYS_BEFORE,
    ORDER_STATUSES,
    ORDER_STATUS_LABELS,
    byDeparture,
    closeWave,
    createWave,
    departWave,
    parseDirection,
    postponeWave,
    pushOrderStatus,
    withSyncedState,
} = require('../lib/waves')

const router = express.Router()

router.post('/login', async (req, res) => {
    assertLoginAllowed(req.ip)
    const token = login(req.body?.password)

    if (!token) {
        const left = registerLoginFailure(req.ip)
        await new Promise((resolve) => setTimeout(resolve, 400))
        throw new HttpError(401, left > 0 ? `Неверный пароль. Осталось попыток: ${left}` : 'Неверный пароль. Вход закрыт на 15 минут')
    }

    clearLoginFailures(req.ip)
    res.json({ token })
})

router.use(requireAdmin)

router.post('/logout', (req, res) => {
    logout(req.adminToken)
    res.json({ ok: true })
})

router.get('/products', async (req, res) => {
    res.json(await db.read('products'))
})

router.post('/products', async (req, res) => {
    const data = validateProduct(req.body)

    const product = await db.transaction(async ({ read, write }) => {
        const products = await read('products')
        const created = { id: nextProductId(products, data.region), ...data }

        products.push(created)
        await write('products', products)

        return created
    })

    res.status(201).json(product)
})

router.put('/products/:id', async (req, res) => {
    const data = validateProduct(req.body)

    const product = await db.transaction(async ({ read, write }) => {
        const products = await read('products')
        const index = products.findIndex((p) => p.id === req.params.id)

        if (index === -1) throw new HttpError(404, 'Товар не найден')

        products[index] = { id: products[index].id, ...data }
        await write('products', products)

        return products[index]
    })

    res.json(product)
})

router.delete('/products/:id', async (req, res) => {
    await db.transaction(async ({ read, write }) => {
        const products = await read('products')
        const rest = products.filter((p) => p.id !== req.params.id)

        if (rest.length === products.length) throw new HttpError(404, 'Товар не найден')

        await write('products', rest)
    })

    res.json({ id: req.params.id })
})

function adminWave(wave, orders) {
    const waveOrders = orders.filter((o) => o.waveId === wave.id)
    return { ...wave, orderCount: waveOrders.length }
}

router.get('/waves', async (req, res) => {
    const { waves, orders } = await withSyncedState()

    res.json(
        [...waves]
            .sort((a, b) => a.direction.localeCompare(b.direction) || byDeparture(a, b))
            .map((w) => adminWave(w, orders))
    )
})

router.post('/waves', async (req, res) => {
    const direction = parseDirection(req.body?.direction, { required: true })
    const departureDate = req.body?.departureDate

    if (!isValidISODate(departureDate)) {
        throw new HttpError(400, 'Укажите дату отправки в формате ГГГГ-ММ-ДД')
    }
    if (addDays(departureDate, -CUTOFF_DAYS_BEFORE) < todayISO()) {
        throw new HttpError(400, `Дата отправки должна быть не раньше чем через ${CUTOFF_DAYS_BEFORE} дня: иначе приём заказов уже закрыт`)
    }

    const wave = await withSyncedState(async ({ waves, orders, write }) => {
        const duplicate = waves.find(
            (w) => w.direction === direction && w.departureDate === departureDate && w.status !== 'merged'
        )
        if (duplicate) throw new HttpError(409, 'В этом направлении уже есть волна на эту дату')

        const created = createWave(waves, direction, departureDate, 'Волна создана администратором')
        await write('waves', waves)

        return adminWave(created, orders)
    })

    res.status(201).json(wave)
})

const WAVE_ACTIONS = ['close', 'depart', 'postpone']

router.put('/waves/:id', async (req, res) => {
    const action = req.body?.action
    if (!WAVE_ACTIONS.includes(action)) {
        throw new HttpError(400, 'Действие: close (закрыть приём), depart (отправить) или postpone (перенести)')
    }

    const wave = await withSyncedState(async ({ waves, orders, write }) => {
        const target = waves.find((w) => w.id === req.params.id)
        if (!target) throw new HttpError(404, 'Волна не найдена')

        const underMin = target.currentWeightKg < target.minWeightKg

        if (action === 'close') {
            if (target.status !== 'open') throw new HttpError(409, 'Приём заказов в эту волну уже закрыт')
            if (underMin) {
                throw new HttpError(409, `В волне меньше ${target.minWeightKg} кг — её нужно перенести, а не закрывать`)
            }
            closeWave(target, orders, 'Приём закрыт администратором')
        }

        if (action === 'depart') {
            if (target.status !== 'closed') throw new HttpError(409, 'Отправить можно только волну с закрытым приёмом')
            if (underMin) throw new HttpError(409, `В волне меньше ${target.minWeightKg} кг — перенесите её`)
            departWave(target, orders)
        }

        if (action === 'postpone') {
            if (target.status !== 'open') throw new HttpError(409, 'Перенести можно только волну, в которую идёт приём заказов')
            if (!underMin) {
                throw new HttpError(409, `Волна набрала минимум ${target.minWeightKg} кг — переносить её не нужно`)
            }
            postponeWave(target, waves, orders, 'волна не набрала минимальную загрузку')
        }

        await write('orders', orders)
        await write('waves', waves)

        return adminWave(target, orders)
    })

    res.json(wave)
})

router.get('/orders', async (req, res) => {
    const { waves, orders } = await withSyncedState()

    res.json(
        orders
            .map((o) => withWave(o, waves))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    )
})

router.patch('/orders/:id/status', async (req, res) => {
    const status = req.body?.status
    if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Недопустимый статус')

    const order = await withSyncedState(async ({ waves, orders, write }) => {
        const target = orders.find((o) => o.id === req.params.id)
        if (!target) throw new HttpError(404, 'Заказ не найден')

        const next = ORDER_STATUSES[ORDER_STATUSES.indexOf(target.status) + 1]
        if (!next) throw new HttpError(409, 'Заказ уже получен — статус больше не меняется')
        if (status !== next) {
            throw new HttpError(409, `Статус меняется только по порядку: следующий — «${ORDER_STATUS_LABELS[next]}»`)
        }

        pushOrderStatus(target, status, nowISO(), 'Изменено администратором')
        await write('orders', orders)

        return withWave(target, waves)
    })

    res.json(order)
})

module.exports = router
