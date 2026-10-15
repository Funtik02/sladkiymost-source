const INN_WEIGHTS = {
    10: [[2, 4, 10, 3, 5, 9, 4, 6, 8]],
    12: [
        [7, 2, 4, 10, 3, 5, 9, 4, 6, 8],
        [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8],
    ],
}

export function isValidInn(value) {
    const inn = String(value ?? '').trim()
    if (!/^\d{10}$|^\d{12}$/.test(inn)) return false

    const digits = [...inn].map(Number)
    return INN_WEIGHTS[inn.length].every((weights) => {
        const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0)
        return (sum % 11) % 10 === digits[weights.length]
    })
}

export const isEntrepreneurInn = (value) => /^\d{12}$/.test(String(value ?? '').trim())

export function isValidKpp(value) {
    return /^\d{4}[\dA-Z]{2}\d{3}$/.test(String(value ?? '').trim().toUpperCase())
}

export const PAYMENT_OPTIONS = {
    person: [
        { value: 'card', title: 'Картой онлайн (имитация)', text: 'Демонстрационная оплата: успешна через 1,5 секунды' },
        { value: 'cash', title: 'При получении', text: 'Картой или наличными на пункте выдачи' },
    ],
    company: [
        { value: 'invoice', title: 'По счёту', text: 'Безналичный расчёт: счёт и закрывающие документы придут на email' },
        { value: 'card', title: 'Корпоративной картой (имитация)', text: 'Демонстрационная оплата: успешна через 1,5 секунды' },
    ],
}

export function paymentStatusLabel(payment) {
    if (payment.status === 'paid') return 'оплачено картой'
    if (payment.status === 'invoice') return 'оплата по счёту'
    return 'оплата при получении'
}

export function paymentSuccessText(payment) {
    if (payment.status === 'paid') return 'Оплата получена (имитация).'
    if (payment.status === 'invoice') return 'Счёт на оплату придёт на email контактного лица.'
    return 'Оплата — при получении.'
}

export function personRole(order) {
    if (order.company) return 'Контактное лицо'
    return order.scenario === 'gift' ? 'Отправитель' : 'Покупатель'
}

export function orderKindLabel(order) {
    if (order.company) return 'юридическое лицо'
    return order.scenario === 'gift' ? 'подарок' : 'заказ себе'
}
