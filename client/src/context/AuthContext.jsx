import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as accountApi from '../api/account'
import { readJSON, removeKey, writeJSON } from '../utils/storage'

const STORAGE_KEY = 'sweet-bridge:user-token'

const AuthContext = createContext(null)

function savedToken() {
    const token = readJSON(localStorage, STORAGE_KEY, null)
    return typeof token === 'string' ? token : null
}

export function AuthProvider({ children }) {
    const [token, setToken] = useState(savedToken)
    const [user, setUser] = useState(null)
    const [checking, setChecking] = useState(() => Boolean(savedToken()))

    const forget = useCallback(() => {
        removeKey(localStorage, STORAGE_KEY)
        setToken(null)
        setUser(null)
    }, [])

    useEffect(() => {
        if (!token || user) return undefined

        const controller = new AbortController()
        accountApi
            .getMe(token, controller.signal)
            .then(({ user: me }) => setUser(me))
            .catch((error) => {
                if (error.name === 'AbortError') return
                if (error.status === 401) forget()
            })
            .finally(() => {
                if (!controller.signal.aborted) setChecking(false)
            })

        return () => controller.abort()
    }, [token, user, forget])

    const startSession = useCallback(({ token: newToken, user: newUser }) => {
        writeJSON(localStorage, STORAGE_KEY, newToken)
        setToken(newToken)
        setUser(newUser)
        setChecking(false)
    }, [])

    const login = useCallback(async (email, password) => startSession(await accountApi.login(email, password)), [startSession])
    const register = useCallback(async (data) => (await accountApi.register(data)).verification, [])
    const verifyEmail = useCallback(async (data) => startSession(await accountApi.verifyEmail(data)), [startSession])

    const logout = useCallback(async () => {
        const current = token
        forget()
        if (current) await accountApi.logout(current).catch(() => {})
    }, [token, forget])

    const value = useMemo(
        () => ({ token, user, checking, isLoggedIn: Boolean(token && user), login, register, verifyEmail, logout, forget }),
        [token, user, checking, login, register, verifyEmail, logout, forget]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider')
    return context
}
