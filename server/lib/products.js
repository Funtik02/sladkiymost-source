const HttpError = require('./httpError')

const REGIONS = ['Якутия', 'ДНР']

const REGION_ALIASES = {
    якутия: 'Якутия',
    yakutia: 'Якутия',
    днр: 'ДНР',
    donbass: 'ДНР',
    dnr: 'ДНР',
}

const ID_PREFIX = { Якутия: 'YKT', ДНР: 'DNR' }

const SORTS = ['popular', 'price_asc', 'price_desc', 'new']

function parseRegion(value) {
    if (value === undefined || value === '') return null

    const region = REGION_ALIASES[String(value).trim().toLowerCase()]
    if (!region) throw new HttpError(400, 'Неизвестный регион. Допустимо: Якутия или ДНР')

    return region
}

function getSoldCounts(orders) {
    const sold = new Map()
    const add = (id, qty) => sold.set(id, (sold.get(id) ?? 0) + qty)

    for (const order of orders) {
        for (const item of order.items) {
            if (item.type === 'giftBox') {
                item.contents.forEach((c) => add(c.productId, item.qty))
            } else {
                add(item.productId, item.qty)
            }
        }
    }

    return sold
}

function parseNumberParam(value, name) {
    if (value === undefined || value === '') return null

    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) {
        throw new HttpError(400, `Параметр ${name} должен быть неотрицательным числом`)
    }

    return number
}

function filterProducts(products, orders, query) {
    const region = parseRegion(query.region)
    const minPrice = parseNumberParam(query.minPrice, 'minPrice')
    const maxPrice = parseNumberParam(query.maxPrice, 'maxPrice')
    const limit = parseNumberParam(query.limit, 'limit')
    const sort = query.sort || 'popular'
    const category = query.category ? String(query.category) : ''
    const manufacturer = query.manufacturer ? String(query.manufacturer) : ''
    const search = String(query.search ?? '').trim().toLowerCase()
    const onlyNotSensitive = ['1', 'true'].includes(String(query.noTempSensitive))
    const ids = query.ids ? String(query.ids).split(',').map((s) => s.trim()).filter(Boolean) : null

    if (!SORTS.includes(sort)) {
        throw new HttpError(400, `Неизвестная сортировка. Допустимо: ${SORTS.join(', ')}`)
    }

    const position = new Map(products.map((p, index) => [p.id, index]))

    let result = products.filter((p) => {
        if (ids && !ids.includes(p.id)) return false
        if (region && p.region !== region) return false
        if (category && p.category !== category) return false
        if (manufacturer && p.manufacturer !== manufacturer) return false
        if (minPrice !== null && p.price_rub < minPrice) return false
        if (maxPrice !== null && p.price_rub > maxPrice) return false
        if (onlyNotSensitive && p.temp_sensitive) return false

        if (search) {
            const haystack = [p.name, p.description, p.category, p.manufacturer].join(' ').toLowerCase()
            if (!haystack.includes(search)) return false
        }

        return true
    })

    const byName = (a, b) => a.name.localeCompare(b.name, 'ru')

    if (sort === 'price_asc') {
        result.sort((a, b) => a.price_rub - b.price_rub || byName(a, b))
    } else if (sort === 'price_desc') {
        result.sort((a, b) => b.price_rub - a.price_rub || byName(a, b))
    } else if (sort === 'new') {
        result.sort((a, b) => position.get(b.id) - position.get(a.id))
    } else {
        const sold = getSoldCounts(orders)
        result.sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0) || byName(a, b))
    }

    if (limit) result = result.slice(0, limit)

    return result
}

function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'))
}

function requireString(body, field, label, min, max) {
    const value = typeof body[field] === 'string' ? body[field].trim() : ''

    if (value.length < min) throw new HttpError(400, `${label}: минимум ${min} симв.`)
    if (value.length > max) throw new HttpError(400, `${label}: максимум ${max} симв.`)

    return value
}

function requireInteger(body, field, label, min, max) {
    const value = Number(body[field])

    if (!Number.isInteger(value) || value < min || value > max) {
        throw new HttpError(400, `${label}: целое число от ${min} до ${max}`)
    }

    return value
}

const PHOTO_RE = /^(https?:\/\/\S+|[\w.-]+\.(jpe?g|png|webp|svg|gif))$/i

function validateProduct(body) {
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Нет данных товара')

    if (!REGIONS.includes(body.region)) {
        throw new HttpError(400, 'Регион: выберите «Якутия» или «ДНР»')
    }

    if (typeof body.temp_sensitive !== 'boolean') {
        throw new HttpError(400, 'Поле temp_sensitive должно быть true или false')
    }

    const photo = typeof body.photo === 'string' ? body.photo.trim() : ''
    if (photo && (photo.length > 500 || !PHOTO_RE.test(photo))) {
        throw new HttpError(400, 'Фото: укажите ссылку http(s):// или имя файла вида ykt-001.jpg')
    }

    return {
        region: body.region,
        manufacturer: requireString(body, 'manufacturer', 'Производитель', 2, 80),
        name: requireString(body, 'name', 'Название', 2, 120),
        category: requireString(body, 'category', 'Категория', 2, 60),
        weight_g: requireInteger(body, 'weight_g', 'Вес, г', 1, 50000),
        price_rub: requireInteger(body, 'price_rub', 'Цена, ₽', 1, 1000000),
        temp_sensitive: body.temp_sensitive,
        shelf_life_days: requireInteger(body, 'shelf_life_days', 'Срок годности, дней', 1, 3650),
        photo,
        description: requireString(body, 'description', 'Описание', 10, 2000),
    }
}

function nextProductId(products, region) {
    const prefix = ID_PREFIX[region]
    const max = products
        .filter((p) => p.id.startsWith(`${prefix}-`))
        .reduce((acc, p) => Math.max(acc, Number(p.id.slice(prefix.length + 1)) || 0), 0)

    return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

module.exports = {
    REGIONS,
    parseRegion,
    filterProducts,
    uniqueSorted,
    validateProduct,
    nextProductId,
    getSoldCounts,
}
