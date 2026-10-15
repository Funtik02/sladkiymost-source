import { CARD_TEXT_MAX } from './gift.js'
import { PAYMENT_OPTIONS, isEntrepreneurInn, isValidInn, isValidKpp } from './company.js'

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

function validateCompany(company) {
    const name = company.name.trim()
    const inn = company.inn.trim()
    const kpp = company.kpp.trim()
    const address = company.address.trim()

    return {
        'company.name': !name ? 'Укажите название организации' : name.length > 160 ? 'Не больше 160 символов' : '',
        'company.inn': !inn
            ? 'Укажите ИНН'
            : isValidInn(inn)
              ? ''
              : 'ИНН — 10 цифр для организации или 12 для ИП; проверьте цифры',
        'company.kpp': isEntrepreneurInn(inn) && !kpp ? '' : !kpp ? 'Укажите КПП' : isValidKpp(kpp) ? '' : 'КПП — 9 символов',
        'company.address': !address
            ? 'Укажите юридический адрес'
            : address.length < 10
              ? 'Адрес слишком короткий'
              : address.length > 250
                ? 'Не больше 250 символов'
                : '',
    }
}

export function validateCheckout(form) {
    const errors = {
        ...(form.buyerType === 'company' ? validateCompany(form.company) : {}),
        'customer.name': validateName(form.customer.name),
        'customer.phone': validatePhone(form.customer.phone),
        'customer.email': validateEmail(form.customer.email),
        pickupPointId: form.pickupPointId ? '' : 'Выберите пункт выдачи',
        paymentMethod: PAYMENT_OPTIONS[form.buyerType === 'company' ? 'company' : 'person'].some((o) => o.value === form.paymentMethod)
            ? ''
            : 'Выберите способ оплаты',
    }

    if (form.buyerType !== 'company' && form.scenario === 'gift') {
        errors['recipient.name'] = validateName(form.recipient.name)
        errors['recipient.phone'] = validatePhone(form.recipient.phone)
        errors['gift.cardText'] = form.gift.cardText.length > CARD_TEXT_MAX ? `Не больше ${CARD_TEXT_MAX} символов` : ''
    }

    return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}
