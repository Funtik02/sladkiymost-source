import { readJSON, removeKey, writeJSON } from './storage.js'

const RECENT_KEY = 'sweet-bridge:recent-searches'
const RECENT_LIMIT = 5

export const POPULAR_QUERIES = ['брусника', 'шоколад', 'вафли', 'торт', 'мармелад', 'зефир']

export const SITE_PAGES = [
    { to: '/catalog/yakutia', title: 'Сладости Якутии', keywords: 'якутия якутск север северные яхк каталог витрина' },
    { to: '/catalog/donbass', title: 'Сладости Донбасса', keywords: 'донбасс днр донецк юг южные каталог витрина' },
    { to: '/gift-box', title: 'Набор «Север + Юг»', keywords: 'набор подарок подарочный север юг собрать' },
    { to: '/waves', title: 'Загрузка волн', keywords: 'волна волны загрузка отправка доставка скидка расписание' },
    { to: '/track', title: 'Где мой заказ?', keywords: 'отследить отслеживание заказ статус номер где трек', authOnly: true },
    { to: '/about', title: 'О проекте и правилах доставки', keywords: 'проект правила доставка контакты телефон почта термоупаковка оплата пункт выдачи' },
    { to: '/favorites', title: 'Избранное', keywords: 'избранное сердечко понравилось' },
    { to: '/cart', title: 'Корзина', keywords: 'корзина оформить оформление заказ купить' },
]

export function searchPageUrl(query) {
    return `/search?q=${encodeURIComponent(query.trim())}`
}

export function normalizeQuery(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9%]+/g, ' ')
        .trim()
}

export function matchPages(query, { loggedIn = false } = {}) {
    const tokens = normalizeQuery(query).split(' ').filter((t) => t.length >= 2)
    if (tokens.length === 0) return []

    return SITE_PAGES.filter((page) => {
        if (page.authOnly && !loggedIn) return false
        const words = normalizeQuery(`${page.title} ${page.keywords}`).split(' ')
        return tokens.every((token) => words.some((word) => word.startsWith(token) || (token.length >= 4 && word.startsWith(token.slice(0, -1)))))
    })
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function highlightParts(text, query) {
    const tokens = normalizeQuery(query)
        .split(' ')
        .filter((t) => t.length >= 2)
        .map((t) => escapeRegExp(t).replace(/е/g, '[её]'))

    if (tokens.length === 0) return [{ text, match: false }]

    const pattern = new RegExp(`(${tokens.join('|')})`, 'gi')
    return text
        .split(pattern)
        .filter(Boolean)
        .map((part) => ({ text: part, match: new RegExp(`^(${tokens.join('|')})$`, 'i').test(part) }))
}

export function getRecentSearches() {
    const list = readJSON(localStorage, RECENT_KEY, [])
    return Array.isArray(list) ? list.filter((q) => typeof q === 'string' && q.trim()).slice(0, RECENT_LIMIT) : []
}

export function rememberSearch(query) {
    const value = query.trim()
    if (!value) return
    const rest = getRecentSearches().filter((q) => q.toLowerCase() !== value.toLowerCase())
    writeJSON(localStorage, RECENT_KEY, [value, ...rest].slice(0, RECENT_LIMIT))
}

export function forgetSearches() {
    removeKey(localStorage, RECENT_KEY)
}
