import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import TextField from '../../components/TextField'
import { useAdmin } from '../../context/AdminContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export default function AdminLogin() {
    useDocumentTitle('Вход администратора')
    const { isAuthenticated, login, sessionExpired } = useAdmin()
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (isAuthenticated) return <Navigate to="/admin/orders" replace />

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!password) {
            setError('Введите пароль')
            return
        }

        setSubmitting(true)
        setError('')

        try {
            await login(password)
        } catch (err) {
            setError(err.message)
            setSubmitting(false)
        }
    }

    return (
        <div className="container section narrow">
            <form className="card login" onSubmit={handleSubmit} noValidate>
                <h1 className="page-title">Вход администратора</h1>
                {sessionExpired && (
                    <p className="notice notice--warning" role="status">
                        Сессия истекла или сервер перезапускался — войдите снова.
                    </p>
                )}
                <TextField
                    id="admin-password"
                    label="Пароль"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    error={error}
                    onChange={(event) => {
                        setPassword(event.target.value)
                        setError('')
                    }}
                    autoFocus
                />
                <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
                    {submitting ? 'Входим…' : 'Войти'}
                </button>
                <p className="muted login__hint">Пароль задаётся переменной окружения ADMIN_PASSWORD на сервере.</p>
            </form>
        </div>
    )
}
