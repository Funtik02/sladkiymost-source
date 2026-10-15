import { request, toQuery } from './client'

export function getProducts(params = {}, signal) {
    return request(`/products${toQuery(params)}`, { signal })
}

export function getProductsByIds(ids, signal) {
    if (ids.length === 0) return Promise.resolve([])
    return request(`/products${toQuery({ ids: ids.join(',') })}`, { signal })
}

export function getProduct(id, signal) {
    return request(`/products/${encodeURIComponent(id)}`, { signal })
}

export function getCategories(region, signal) {
    return request(`/categories${toQuery({ region })}`, { signal })
}

export function getManufacturers(region, signal) {
    return request(`/manufacturers${toQuery({ region })}`, { signal })
}
