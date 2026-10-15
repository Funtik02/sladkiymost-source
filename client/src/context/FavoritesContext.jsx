import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readJSON, writeJSON } from '../utils/storage'

const STORAGE_KEY = 'sweet-bridge:favorites'

const FavoritesContext = createContext(null)

function loadFavorites() {
    const saved = readJSON(localStorage, STORAGE_KEY, [])
    return Array.isArray(saved) ? [...new Set(saved.filter((id) => typeof id === 'string' && id))] : []
}

export function FavoritesProvider({ children }) {
    const [ids, setIds] = useState(loadFavorites)

    useEffect(() => {
        writeJSON(localStorage, STORAGE_KEY, ids)
    }, [ids])

    const toggle = useCallback((id) => {
        setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
    }, [])

    const keepOnly = useCallback((existingIds) => {
        setIds((list) => {
            const next = list.filter((id) => existingIds.includes(id))
            return next.length === list.length ? list : next
        })
    }, [])

    const value = useMemo(
        () => ({
            ids,
            count: ids.length,
            has: (id) => ids.includes(id),
            toggle,
            keepOnly,
        }),
        [ids, toggle, keepOnly]
    )

    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
    const context = useContext(FavoritesContext)
    if (!context) throw new Error('useFavorites должен использоваться внутри FavoritesProvider')
    return context
}
