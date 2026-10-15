require('./lib/env')
const express = require('express')
const fs = require('fs')
const path = require('path')
const catalogRouter = require('./routes/catalog')
const wavesRouter = require('./routes/waves')
const ordersRouter = require('./routes/orders')
const adminRouter = require('./routes/admin')
const { router: accountRouter } = require('./routes/account')
const HttpError = require('./lib/httpError')
const { getAdminPassword } = require('./lib/auth')
const mailer = require('./lib/mailer')
const { withSyncedState } = require('./lib/waves')

const app = express()
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist')
const serveClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'))

app.disable('x-powered-by')
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1))
app.use(express.json({ limit: '100kb' }))

app.use('/images', express.static(path.join(__dirname, 'public', 'images')))

if (!serveClient) {
    app.get('/', (req, res) => {
        res.json({ message: 'Сладкий мост API работает' })
    })
}

app.use('/api/admin', adminRouter)
app.use('/api', accountRouter)
app.use('/api', catalogRouter)
app.use('/api', wavesRouter)
app.use('/api', ordersRouter)

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Такого адреса API нет' })
})

if (serveClient) {
    app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }))
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }))
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/images/')) return next()
        res.sendFile(path.join(CLIENT_DIST, 'index.html'))
    })
}

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)

    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, ...err.details })
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Некорректный JSON в теле запроса' })
    }

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Слишком большой запрос' })
    }

    console.error('Необработанная ошибка:', err)
    res.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте ещё раз' })
})

app.listen(PORT, async () => {
    console.log(`Сладкий мост ${serveClient ? 'сайт и API' : 'API'}: http://localhost:${PORT}`)

    if (!mailer.isEnabled()) {
        console.warn('Почта не настроена (RUSENDER_API_KEY, MAIL_FROM_EMAIL): коды подтверждения будут печататься здесь, в консоли')
    }
    if (!getAdminPassword()) {
        console.warn('ADMIN_PASSWORD не задан — вход в админку закрыт')
    }

    try {
        await withSyncedState()
    } catch (error) {
        console.error('Не удалось синхронизировать волны:', error.message)
    }
})
