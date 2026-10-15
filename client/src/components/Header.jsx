import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useAuth } from '../context/AuthContext'
import { CartIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from './Icons'
import LogoMark from './Logo'
import SearchDialog from './SearchDialog'
import SoundToggle from './SoundToggle'

const NAV_ITEMS = [
    { to: '/catalog/yakutia', label: 'Сладости Якутии' },
    { to: '/catalog/donbass', label: 'Сладости Донбасса' },
    { to: '/gift-box', label: 'Набор «Север + Юг»' },
    { to: '/waves', label: 'Волны' },
    { to: '/track', label: 'Где заказ?', authOnly: true },
    { to: '/about', label: 'О проекте' },
]

export default function Header() {
    const { count } = useCart()
    const favorites = useFavorites()
    const { user } = useAuth()
    const { pathname } = useLocation()

    const [menuPath, setMenuPath] = useState(null)
    const menuOpen = menuPath === pathname
    const setMenuOpen = (open) => setMenuPath(open ? pathname : null)

    useEffect(() => {
        if (!menuOpen) return undefined

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setMenuPath(null)
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [menuOpen])

    const closeMenu = () => setMenuOpen(false)

    const [searchOpen, setSearchOpen] = useState(false)

    useEffect(() => {
        const onKeyDown = (event) => {
            const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')
            const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
            if (shortcut || (event.key === '/' && !typing)) {
                event.preventDefault()
                setMenuPath(null)
                setSearchOpen(true)
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <header className="header">
            <div className="container header__inner">
                <Link to="/" className="logo" onClick={closeMenu} aria-label="Сладкий мост — на главную">
                    <LogoMark className="logo__mark" />
                    <span className="logo__text">
                        сладкий
                        <br />
                        мост
                    </span>
                </Link>

                <nav id="main-nav" className={`nav ${menuOpen ? 'nav--open' : ''}`} aria-label="Основное меню">
                    <ul className="nav__list">
                        {NAV_ITEMS.filter((item) => user || !item.authOnly).map((item) => (
                            <li key={item.to}>
                                <NavLink to={item.to} className="nav__link" onClick={closeMenu}>
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}
                        <li className="nav__sound">
                            <SoundToggle className="nav__link nav__sound-toggle" withLabel />
                        </li>
                    </ul>
                </nav>

                <div className="header__actions">
                    <SoundToggle className="header__icon header__sound" />
                    <button
                        type="button"
                        className="header__icon"
                        onClick={() => {
                            closeMenu()
                            setSearchOpen(true)
                        }}
                        aria-label="Поиск (Ctrl+K)"
                        title="Поиск (Ctrl+K)"
                    >
                        <SearchIcon />
                    </button>
                    <NavLink
                        to="/favorites"
                        className="header__icon"
                        onClick={closeMenu}
                        aria-label={`Избранное: ${favorites.count}`}
                    >
                        <HeartIcon />
                        {favorites.count > 0 && <span className="header__badge header__badge--soft">{favorites.count}</span>}
                    </NavLink>
                    <NavLink
                        to="/account"
                        className="header__icon"
                        onClick={closeMenu}
                        aria-label={user ? `Личный кабинет: ${user.name}` : 'Войти в личный кабинет'}
                        title={user ? user.name : 'Личный кабинет'}
                    >
                        <UserIcon />
                        {user && <span className="header__dot" aria-hidden="true" />}
                    </NavLink>
                    <NavLink to="/cart" className="header__icon" onClick={closeMenu} aria-label={`Корзина: ${count} шт.`}>
                        <CartIcon />
                        {count > 0 && <span className="header__badge">{count > 99 ? '99+' : count}</span>}
                    </NavLink>
                    <button
                        type="button"
                        className="header__icon header__burger"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-expanded={menuOpen}
                        aria-controls="main-nav"
                        aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
                    >
                        {menuOpen ? <CloseIcon /> : <MenuIcon />}
                    </button>
                </div>
            </div>
            <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>
    )
}
