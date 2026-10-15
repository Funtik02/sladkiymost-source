import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCart, saveCart } from '../api/account'
import ConfirmDialog from '../components/ConfirmDialog'
import { itemDirection, makeGiftBoxItem, makeProductItem } from '../utils/cart'
import { calcWeightKg } from '../utils/delivery'
import { DIRECTIONS, REGIONS } from '../utils/regions'
import { playSound } from '../utils/sound'
import { readJSON, removeKey, writeJSON } from '../utils/storage'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const STORAGE_KEY = 'sweet-bridge:cart'
const PENDING_KEY = 'sweet-bridge:pending-cart-item'
const PENDING_TTL_MS = 30 * 60 * 1000
const SAVE_DELAY_MS = 400
const MAX_QTY = 99

const initialState = { items: [], direction: null, waveId: null, thermoChosen: false, consent: false }

const clampQty = (qty) => Math.min(MAX_QTY, Math.max(1, Math.round(Number(qty)) || 1))

function cartReducer(state, action) {
    switch (action.type) {
        case 'ADD': {
            const direction = itemDirection(action.item)
            if (state.direction && state.items.length && direction !== state.direction) return state

            const existing = state.items.find((i) => i.key === action.item.key)
            const items = existing
                ? state.items.map((i) => (i.key === action.item.key ? { ...i, qty: clampQty(i.qty + action.qty) } : i))
                : [...state.items, { ...action.item, qty: clampQty(action.qty) }]

            const sameDirection = state.direction === direction
            return {
                ...state,
                items,
                direction,
                waveId: sameDirection ? state.waveId : null,
                thermoChosen: sameDirection ? state.thermoChosen : false,
            }
        }

        case 'REMOVE': {
            const items = state.items.filter((i) => i.key !== action.key)
            return items.length ? { ...state, items } : initialState
        }

        case 'INCREMENT':
        case 'DECREMENT': {
            const delta = action.type === 'INCREMENT' ? 1 : -1
            return {
                ...state,
                items: state.items.map((i) => (i.key === action.key ? { ...i, qty: clampQty(i.qty + delta) } : i)),
            }
        }

        case 'SET_QTY':
            return {
                ...state,
                items: state.items.map((i) => (i.key === action.key ? { ...i, qty: clampQty(action.qty) } : i)),
            }

        case 'CLEAR':
            return initialState

        case 'LOAD':
            return action.state

        case 'SET_WAVE':
            return { ...state, waveId: action.waveId }

        case 'SET_THERMO':
            return { ...state, thermoChosen: Boolean(action.value) }

        case 'SET_CONSENT':
            return { ...state, consent: Boolean(action.value) }

        case 'SYNC_PRODUCTS': {
            const byId = new Map(action.products.map((p) => [p.id, p]))
            const items = state.items
                .map((item) => {
                    if (item.type === 'giftBox') {
                        const contents = item.contents.map((c) => byId.get(c.productId))
                        if (contents.some((c) => !c)) return null
                        return makeGiftBoxItem(contents, item.destination, item.key, item.qty)
                    }

                    const product = byId.get(item.productId)
                    return product ? { ...makeProductItem(product), qty: item.qty } : null
                })
                .filter(Boolean)

            return items.length ? { ...state, items } : initialState
        }

        default:
            return state
    }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const isStr = (v) => typeof v === 'string' && v.length > 0

function isValidContent(c) {
    return c && isStr(c.productId) && isStr(c.name) && REGIONS[c.region] && isNum(c.weight_g) && isNum(c.price_rub) && isNum(c.shelf_life_days)
}

function isValidItem(item) {
    if (!item || !isStr(item.key) || !isStr(item.name) || !isNum(item.weight_g) || !isNum(item.price_rub) || !isNum(item.shelf_life_days)) {
        return false
    }

    if (item.type === 'giftBox') {
        return REGIONS[item.destination] && Array.isArray(item.contents) && item.contents.length > 0 && item.contents.every(isValidContent)
    }

    return item.type === 'product' && isStr(item.productId) && Boolean(REGIONS[item.region])
}

function parseCart(saved) {
    if (!saved || !Array.isArray(saved.items)) return initialState

    const valid = saved.items
        .filter(isValidItem)
        .map((item) => ({ ...item, temp_sensitive: Boolean(item.temp_sensitive), qty: clampQty(item.qty) }))
    if (valid.length === 0) return initialState

    const direction = itemDirection(valid[0])
    const items = valid.filter((item) => itemDirection(item) === direction)

    return {
        items,
        direction,
        waveId: isStr(saved.waveId) ? saved.waveId : null,
        thermoChosen: saved.thermoChosen === true,
        consent: saved.consent === true,
    }
}

function takeLegacyCart() {
    const legacy = parseCart(readJSON(localStorage, STORAGE_KEY, null))
    removeKey(localStorage, STORAGE_KEY)
    return legacy
}

function takePendingItem() {
    const saved = readJSON(sessionStorage, PENDING_KEY, null)
    removeKey(sessionStorage, PENDING_KEY)

    const fresh = saved && Date.now() - Number(saved.savedAt) < PENDING_TTL_MS
    if (!fresh || !isValidItem(saved.item)) return null

    return { item: { ...saved.item, temp_sensitive: Boolean(saved.item.temp_sensitive) }, qty: clampQty(saved.qty) }
}

const CartContext = createContext(null)

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, initialState)
    const [pending, setPending] = useState(null)
    const { showToast } = useToast()
    const { token, user, checking, forget } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const userId = user?.id ?? null
    const [syncedFor, setSyncedFor] = useState(null)
    const [cartOwner, setCartOwner] = useState(token)
    const syncing = Boolean(token) && (checking || syncedFor !== userId)

    if (cartOwner !== token) {
        setCartOwner(token)
        dispatch({ type: 'CLEAR' })
        setSyncedFor(null)
    }

    const notifyAdded = useCallback(
        (item) => {
            const message = item.type === 'giftBox' ? 'Набор добавлен в корзину' : 'Товар добавлен в корзину'
            playSound('add')
            showToast(message, { action: { label: 'В корзину', to: '/cart' } })
        },
        [showToast]
    )

    useEffect(() => {
        if (!token || !userId) return undefined

        const controller = new AbortController()
        getCart(token, controller.signal)
            .then(({ cart }) => {
                const fromServer = parseCart(cart)
                const legacy = takeLegacyCart()
                const loaded = fromServer.items.length === 0 && legacy.items.length > 0 ? legacy : fromServer
                dispatch({ type: 'LOAD', state: loaded })
                setSyncedFor(userId)

                const added = takePendingItem()
                if (!added) return
                if (loaded.items.length > 0 && loaded.direction !== itemDirection(added.item)) {
                    setPending({ ...added, resolve: () => {} })
                } else {
                    dispatch({ type: 'ADD', item: added.item, qty: added.qty })
                    notifyAdded(added.item)
                }
            })
            .catch((error) => {
                if (error.name === 'AbortError') return
                if (error.status === 401) forget()
                else showToast('Не удалось загрузить корзину из аккаунта. Обновите страницу', { type: 'error' })
            })

        return () => controller.abort()
    }, [token, userId, forget, notifyAdded, showToast])

    useEffect(() => {
        if (!token || !userId || syncedFor !== userId) return undefined

        const timer = setTimeout(() => {
            saveCart(token, state).catch((error) => {
                if (error.status === 401) forget()
            })
        }, SAVE_DELAY_MS)

        return () => clearTimeout(timer)
    }, [state, token, userId, syncedFor, forget])

    const hasItems = state.items.length > 0
    const putItem = useCallback(
        (item, qty = 1) =>
            new Promise((resolve) => {
                const conflict = hasItems && state.direction !== itemDirection(item)

                if (conflict) {
                    setPending({ item, qty, resolve })
                    return
                }

                dispatch({ type: 'ADD', item, qty })
                notifyAdded(item)
                resolve(true)
            }),
        [hasItems, state.direction, notifyAdded]
    )

    const addItem = useCallback(
        (item, qty = 1) => {
            if (token && !syncing) return putItem(item, qty)

            writeJSON(sessionStorage, PENDING_KEY, { item, qty, savedAt: Date.now() })
            if (token) return Promise.resolve(true)

            const next = encodeURIComponent(`${location.pathname}${location.search}`)
            navigate(`/account?reason=cart&next=${next}`)
            return Promise.resolve(false)
        },
        [token, syncing, putItem, location.pathname, location.search, navigate]
    )

    const confirmReplace = () => {
        dispatch({ type: 'CLEAR' })
        dispatch({ type: 'ADD', item: pending.item, qty: pending.qty })
        notifyAdded(pending.item)
        pending.resolve(true)
        setPending(null)
    }

    const cancelReplace = () => {
        pending.resolve(false)
        setPending(null)
    }

    const actions = useMemo(
        () => ({
            addItem,
            remove: (key) => dispatch({ type: 'REMOVE', key }),
            increment: (key) => dispatch({ type: 'INCREMENT', key }),
            decrement: (key) => dispatch({ type: 'DECREMENT', key }),
            setQty: (key, qty) => dispatch({ type: 'SET_QTY', key, qty }),
            clear: () => dispatch({ type: 'CLEAR' }),
            setWave: (waveId) => dispatch({ type: 'SET_WAVE', waveId }),
            setThermo: (value) => dispatch({ type: 'SET_THERMO', value }),
            setConsent: (value) => dispatch({ type: 'SET_CONSENT', value }),
            syncProducts: (products) => dispatch({ type: 'SYNC_PRODUCTS', products }),
        }),
        [addItem]
    )

    const value = useMemo(() => {
        const count = state.items.reduce((sum, i) => sum + i.qty, 0)
        const goodsTotal = state.items.reduce((sum, i) => sum + i.price_rub * i.qty, 0)

        return {
            ...state,
            ...actions,
            syncing,
            count,
            goodsTotal,
            weightKg: calcWeightKg(state.items),
        }
    }, [state, actions, syncing])

    return (
        <CartContext.Provider value={value}>
            {children}
            <ConfirmDialog
                open={Boolean(pending)}
                title="Позиции едут разными волнами"
                message={pending ? conflictMessage(state, pending.item) : ''}
                confirmLabel="Очистить и добавить"
                cancelLabel="Оставить как есть"
                onConfirm={confirmReplace}
                onCancel={cancelReplace}
            />
        </CartContext.Provider>
    )
}

function conflictMessage(state, item) {
    const onlyProducts = state.items.every((i) => i.type === 'product')
    const what = item.type === 'giftBox' ? 'этот набор' : 'этот товар'

    if (onlyProducts) {
        const region = REGIONS[state.items[0].region]
        return `В корзине товары из ${region.genitive}. Они едут другой волной. Очистить корзину и добавить ${what}?`
    }

    return `В корзине позиции, которые едут волной «${DIRECTIONS[state.direction].label}». Новая позиция едет другой волной. Очистить корзину и добавить ${what}?`
}

export function useCart() {
    const context = useContext(CartContext)
    if (!context) throw new Error('useCart должен использоваться внутри CartProvider')
    return context
}
