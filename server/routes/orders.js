const express = require('express')
const HttpError = require('../lib/httpError')
const { withSyncedState } = require('../lib/waves')
const { buildOrder, publicOrder, quoteOrder, validateContacts, withWave } = require('../lib/orders')
const { resolveUser } = require('./account')

const router = express.Router()

router.post('/orders/quote', async (req, res) => {
    const result = await withSyncedState(async ({ waves, read }) => {
        const products = await read('products')
        const quote = quoteOrder(req.body, { products, waves })

        return {
            waveId: quote.wave.id,
            goods: quote.goods,
            weightKg: quote.delivery.weightKg,
            delivery: quote.delivery,
            total: quote.total,
        }
    })

    res.json(result)
})

router.post('/orders', async (req, res) => {
    const user = await resolveUser(req)
    if (!user) throw new HttpError(401, 'Войдите в личный кабинет, чтобы оформить заказ')

    const order = await withSyncedState(async ({ waves, orders, read, write }) => {
        const [products, pickupPoints] = await Promise.all([read('products'), read('pickup-points')])

        const quote = quoteOrder(req.body, { products, waves })
        const contacts = validateContacts(req.body, quote.direction, pickupPoints)
        const created = buildOrder(quote, contacts, orders, req.body.thermoChosen)
        created.userId = user.id

        quote.wave.currentWeightKg = quote.delivery.waveWeightAfterKg
        orders.push(created)

        await write('orders', orders)
        await write('waves', waves)

        return withWave(created, waves)
    })

    res.status(201).json({ orderId: order.id, ...order })
})

router.get('/orders/:id', async (req, res) => {
    const { waves, orders } = await withSyncedState()
    const order = orders.find((o) => o.id === req.params.id.trim())

    if (!order) throw new HttpError(404, 'Заказ с таким номером не найден')

    res.json(publicOrder(order, waves))
})

module.exports = router
