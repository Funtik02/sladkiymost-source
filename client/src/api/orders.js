import { request } from './client'

export function quoteOrder(payload) {
    return request('/orders/quote', { method: 'POST', body: payload })
}

export function createOrder(payload, token) {
    return request('/orders', { method: 'POST', body: payload, token })
}

export function getOrder(id, signal) {
    return request(`/orders/${encodeURIComponent(id)}`, { signal })
}
