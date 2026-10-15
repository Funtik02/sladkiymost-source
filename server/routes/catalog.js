const express = require('express')
const db = require('../db')
const HttpError = require('../lib/httpError')
const { filterProducts, getSoldCounts, parseRegion, uniqueSorted } = require('../lib/products')
const { searchProducts } = require('../lib/search')
const { DIRECTIONS, parseDirection } = require('../lib/waves')

const router = express.Router()

router.get('/products', async (req, res) => {
    const [products, orders] = await Promise.all([db.read('products'), db.read('orders')])
    res.json(filterProducts(products, orders, req.query))
})

router.get('/search', async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 0, 0), 50)
    const [products, orders] = await Promise.all([db.read('products'), db.read('orders')])
    res.json(searchProducts(products, getSoldCounts(orders), req.query.q, limit))
})

router.get('/products/:id', async (req, res) => {
    const products = await db.read('products')
    const product = products.find((p) => p.id === req.params.id)

    if (!product) throw new HttpError(404, 'Товар не найден')

    res.json(product)
})

async function productsOfRegion(query) {
    const region = parseRegion(query.region)
    const products = await db.read('products')
    return region ? products.filter((p) => p.region === region) : products
}

router.get('/categories', async (req, res) => {
    const products = await productsOfRegion(req.query)
    res.json(uniqueSorted(products.map((p) => p.category)))
})

router.get('/manufacturers', async (req, res) => {
    const products = await productsOfRegion(req.query)
    res.json(uniqueSorted(products.map((p) => p.manufacturer)))
})

router.get('/pickup-points', async (req, res) => {
    const direction = parseDirection(req.query.direction)
    const points = await db.read('pickup-points')

    res.json(direction ? points.filter((p) => p.city === DIRECTIONS[direction].toCity) : points)
})

module.exports = router
