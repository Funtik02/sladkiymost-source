import { CARD_TEXT_MAX } from './gift.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizePhone(value) {
    const compact = String(value ?? '').replace(/[\s()-]/g, '')

    if (/^8\d{10}$/.test(compact)) return `+7${compact.slice(1)}`
    if (/^9\d{9}$/.test(compact)) return `+7${compact}`
    if (/^7\d{10}$/.test(compact)) return `+${compact}`
    return compact
}

export function isValidPhone(value) {
    return /^\+7\d{10}$/.test(normalizePhone(value))
}

export function formatPhone(value) {
    const phone = normalizePhone(value)
    if (!/^\+7\d{10}$/.test(phone)) return value
    return `+7 ${phone.slice(2, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`
}

export function isValidEmail(value) {
    return EMAIL_RE.test(String(value ?? '').trim())
}

function validateName(value) {
    const name = String(value ?? '').trim()
    if (!name) return 'Укажите имя'
    if (name.length < 2) return 'Имя слишком короткое'
    if (name.length > 80) return 'Не больше 80 символов'
    return ''
}

function validatePhone(value) {
    if (!String(value ?? '').trim()) return 'Укажите телефон'
    return isValidPhone(value) ? '' : 'Телефон в формате +7 XXX XXX-XX-XX'
}

function validateEmail(value) {
    if (!String(value ?? '').trim()) return 'Укажите email'
    return isValidEmail(value) ? '' : 'Проверьте email: пример — name@mail.ru'
}

export function validateCheckout(form) {
    const errors = {
        'customer.name': validateName(form.customer.name),
        'customer.phone': validatePhone(form.customer.phone),
        'customer.email': validateEmail(form.customer.email),
        pickupPointId: form.pickupPointId ? '' : 'Выберите пункт выдачи',
        paymentMethod: form.paymentMethod ? '' : 'Выберите способ оплаты',
    }

    if (form.scenario === 'gift') {
        errors['recipient.name'] = validateName(form.recipient.name)
        errors['recipient.phone'] = validatePhone(form.recipient.phone)
        errors['gift.cardText'] = form.gift.cardText.length > CARD_TEXT_MAX ? `Не больше ${CARD_TEXT_MAX} символов` : ''
    }

    return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}
