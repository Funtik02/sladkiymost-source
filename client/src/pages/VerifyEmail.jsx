import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { playSound } from '../utils/sound'
import { removeKey } from '../utils/storage'

const requests = new Map()

export default function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') ?? ''
    const { verifyEmail } = useAuth()
    const [state, setState] = useState({ status: token ? 'loading' : 'error', message: 'В ссылке нет кода подтверждения' })
    useDocumentTitle('Подтверждение почты')

    useEffect(() => {
        if (!token) return undefined
        let active = true

        if (!requests.has(token)) requests.set(token, verifyEmail({ token }))
        requests
            .get(token)
            .then(() => {
                if (!active) return
                removeKey(sessionStorage, 'sweet-bridge:verify-email')
                playSound('success')
                setState({ status: 'done' })
            })
            .catch((error) => {
                if (active) setState({ status: 'error', message: error.message })
            })

        return () => {
            active = false
        }
    }, [token, verifyEmail])

    return (
        <div className="container section">
            {state.status === 'loading' && <Loader label="Подтверждаем почту…" />}

            {state.status === 'done' && (
                <div className="state state--big">
                    <h1 className="state__title">Почта подтверждена</h1>
                    <p className="state__text">Добро пожаловать на «Сладкий мост»! Вы уже вошли в личный кабинет.</p>
                    <div className="state__actions">
                        <Link to="/catalog/yakutia" className="btn btn--primary">
                            Сладости Якутии
                        </Link>
                        <Link to="/catalog/donbass" className="btn btn--primary">
                            Сладости Донбасса
                        </Link>
                        <Link to="/account" className="btn btn--ghost">
                            Личный кабинет
                        </Link>
                    </div>
                </div>
            )}

            {state.status === 'error' && (
                <div className="state state--big">
                    <h1 className="state__title">Не получилось подтвердить почту</h1>
                    <p className="state__text">{state.message}</p>
                    <Link to="/account" className="btn btn--primary">
                        Войти и получить новый код
                    </Link>
                </div>
            )}
        </div>
    )
}
