import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'

export default function RequireAdmin() {
    const { isAuthenticated, logout } = useAdmin()
    const navigate = useNavigate()

    if (!isAuthenticated) return <Navigate to="/admin" replace />

    const handleLogout = async () => {
        await logout()
        navigate('/admin', { replace: true })
    }

    return (
        <div className="container admin">
            <div className="admin__top">
                <h1 className="admin__title">Админка</h1>
                <nav className="admin__tabs" aria-label="Разделы админки">
                    <NavLink to="/admin/orders" className="admin__tab">
                        Заказы
                    </NavLink>
                    <NavLink to="/admin/waves" className="admin__tab">
                        Волны
                    </NavLink>
                    <NavLink to="/admin/products" className="admin__tab">
                        Товары
                    </NavLink>
                </nav>
                <button type="button" className="btn btn--ghost btn--small" onClick={handleLogout}>
                    Выйти
                </button>
            </div>
            <Outlet />
        </div>
    )
}
