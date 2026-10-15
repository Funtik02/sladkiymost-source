import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { playSound } from '../utils/sound'

const ToastContext = createContext(null)

const TOAST_DURATION_MS = 3500

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const nextId = useRef(1)

    const dismissToast = useCallback((id) => {
        setToasts((list) => list.filter((t) => t.id !== id))
    }, [])

    const showToast = useCallback(
        (message, { type = 'success', action } = {}) => {
            const id = nextId.current++
            if (type === 'error') playSound('error')
            setToasts((list) => [...list.slice(-2), { id, message, type, action }])
            setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
        },
        [dismissToast]
    )

    const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast])

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast должен использоваться внутри ToastProvider')
    return context
}
