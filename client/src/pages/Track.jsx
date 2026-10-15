import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMyOrders } from '../api/account'
import ErrorMessage from '../components/ErrorMessage'
import Loader from '../components/Loader'
import OrderCard from '../components/OrderCard'
import TextField from '../components/TextField'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'

export default function Track() {
    useDocumentTitle('Отследить заказ')
    const navigate = useNavigate()
    const { isLoggedIn, checking } = useAuth()
    const [number, setNumber] = useState('')
    const [error, setError] = useState('')

    if (checking) {
        return (
            <div className="container section narrow">
                <Loader label="Проверяем вход…" />
            </div>
        )
    }

    if (!isLoggedIn) return <Navigate to="/account?reason=track&next=/track" replace />

    const handleSubmit = (event) => {
        event.preventDefault()
        const id = number.replace(/\D/g, '')

        if (!/^\d{6}$/.test(id)) {
            setError('Номер заказа — 6 цифр, например 204817')
            return
        }

        navigate(`/order/${id}`)
    }

    return (
        <div className="container section narrow">
            <h1 className="page-title">Где мой заказ?</h1>
            <p className="page-lead">Введите номер заказа — покажем статус, волну и пункт выдачи.</p>

            <form className="card track-form" onSubmit={handleSubmit} noValidate>
                <TextField
                    id="order-number"
                    label="Номер заказа"
                    value={number}
                    error={error}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="например, 204817"
                    onChange={(event) => {
                        setNumber(event.target.value)
                        setError('')
                    }}
                />
                <button type="submit" className="btn btn--primary">
                    Найти заказ
                </button>
            </form>

            <section className="section-sm" aria-labelledby="my-orders-title">
                <h2 id="my-orders-title" className="section-subtitle">
                    Мои заказы
                </h2>
                <MyOrders />
            </section>
        </div>
    )
}

function MyOrders() {
    const { token, forget } = useAuth()
    const { data, error, loading, reload } = useFetch(
        (signal) =>
            getMyOrders(token, signal).catch((err) => {
                if (err.status === 401) forget()
                throw err
            }),
        [token]
    )

    if (loading && !data) return <Loader label="Загружаем ваши заказы…" />
    if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

    if (data.length === 0) {
        return <p className="muted">У вашего аккаунта пока нет заказов — здесь появятся все, что вы оформите.</p>
    }

    return (
        <ul className="my-orders">
            {data.map((order) => (
                <OrderCard key={order.id} order={order} />
            ))}
        </ul>
    )
}
