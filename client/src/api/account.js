import { request } from './client'

export function register(data) {
    return request('/auth/register', { method: 'POST', body: data })
}

export function verifyEmail(data) {
    return request('/auth/verify-email', { method: 'POST', body: data })
}

export function resendCode(email) {
    return request('/auth/resend-code', { method: 'POST', body: { email } })
}

export function login(email, password) {
    return request('/auth/login', { method: 'POST', body: { email, password } })
}

export function logout(token) {
    return request('/auth/logout', { method: 'POST', token })
}

export function getMe(token, signal) {
    return request('/auth/me', { token, signal })
}

export function getMyOrders(token, signal) {
    return request('/account/orders', { token, signal })
}

export function getCart(token, signal) {
    return request('/account/cart', { token, signal })
}

export function saveCart(token, cart) {
    return request('/account/cart', { method: 'PUT', token, body: { cart } })
}
