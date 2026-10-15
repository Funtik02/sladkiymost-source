import { directionFromRegion, directionToRegion } from './regions.js'

export function itemDirection(item) {
    return item.type === 'giftBox' ? directionToRegion(item.destination) : directionFromRegion(item.region)
}

export function makeProductItem(product) {
    return {
        key: product.id,
        type: 'product',
        productId: product.id,
        name: product.name,
        region: product.region,
        manufacturer: product.manufacturer,
        category: product.category,
        weight_g: product.weight_g,
        price_rub: product.price_rub,
        temp_sensitive: product.temp_sensitive,
        shelf_life_days: product.shelf_life_days,
        photo: product.photo,
    }
}

export function makeGiftBoxItem(products, destination, key = `GB-${Date.now()}`, qty = 1) {
    const contents = products.map((p) => ({
        productId: p.id,
        name: p.name,
        region: p.region,
        weight_g: p.weight_g,
        price_rub: p.price_rub,
        temp_sensitive: p.temp_sensitive,
        shelf_life_days: p.shelf_life_days,
        photo: p.photo,
    }))

    return {
        key,
        type: 'giftBox',
        name: `Набор «Север + Юг» → ${destination}`,
        destination,
        contents,
        weight_g: contents.reduce((sum, c) => sum + c.weight_g, 0),
        price_rub: contents.reduce((sum, c) => sum + c.price_rub, 0),
        temp_sensitive: contents.some((c) => c.temp_sensitive),
        shelf_life_days: Math.min(...contents.map((c) => c.shelf_life_days)),
        qty,
    }
}

export function toOrderItems(items) {
    return items.map((item) =>
        item.type === 'giftBox'
            ? { type: 'giftBox', productIds: item.contents.map((c) => c.productId), destination: item.destination, qty: item.qty }
            : { type: 'product', productId: item.productId, qty: item.qty }
    )
}
