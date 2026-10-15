import { request } from './client'

export function login(password) {
    return request('/admin/login', { method: 'POST', body: { password } })
}

export function logout(token) {
    return request('/admin/logout', { method: 'POST', token })
}

export function getAdminProducts(token, signal) {
    return request('/admin/products', { token, signal })
}

export function createProduct(token, product) {
    return request('/admin/products', { method: 'POST', token, body: product })
}

export function updateProduct(token, id, product) {
    return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', token, body: product })
}

export function deleteProduct(token, id) {
    return request(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

export function getAdminWaves(token, signal) {
    return request('/admin/waves', { token, signal })
}

export function createWave(token, wave) {
    return request('/admin/waves', { method: 'POST', token, body: wave })
}

export function updateWave(token, id, action) {
    return request(`/admin/waves/${encodeURIComponent(id)}`, { method: 'PUT', token, body: { action } })
}

export function getAdminOrders(token, signal) {
    return request('/admin/orders', { token, signal })
}

export function setOrderStatus(token, id, status) {
    return request(`/admin/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', token, body: { status } })
}
