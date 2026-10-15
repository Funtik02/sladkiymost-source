import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Footer from './components/Footer'
import Header from './components/Header'
import RequireAdmin from './components/RequireAdmin'
import ScrollToTop from './components/ScrollToTop'
import Toast from './components/Toast'
import { AdminProvider } from './context/AdminContext'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { ToastProvider } from './context/ToastContext'
import About from './pages/About'
import Account from './pages/Account'
import Cart from './pages/Cart'
import Catalog from './pages/Catalog'
import Checkout from './pages/Checkout'
import Favorites from './pages/Favorites'
import GiftBox from './pages/GiftBox'
import Home from './pages/Home'
import LoadDashboard from './pages/LoadDashboard'
import NotFound from './pages/NotFound'
import Offer from './pages/Offer'
import Order from './pages/Order'
import OrderSuccess from './pages/OrderSuccess'
import Privacy from './pages/Privacy'
import Product from './pages/Product'
import Search from './pages/Search'
import Track from './pages/Track'
import VerifyEmail from './pages/VerifyEmail'
import AdminLogin from './pages/admin/AdminLogin'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminWaves from './pages/admin/AdminWaves'

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true }

export default function App() {
    return (
        <BrowserRouter future={ROUTER_FUTURE}>
            <ToastProvider>
                <FavoritesProvider>
                    <AuthProvider>
                        <CartProvider>
                            <AdminProvider>
                                <ScrollToTop />
                                <a className="skip-link" href="#main">
                                    Перейти к содержимому
                                </a>
                                <div className="app">
                                    <Header />
                                    <main id="main" className="main" tabIndex={-1}>
                                        <Routes>
                                            <Route path="/" element={<Home />} />
                                            <Route path="/catalog/:region" element={<Catalog />} />
                                            <Route path="/product/:id" element={<Product />} />
                                            <Route path="/cart" element={<Cart />} />
                                            <Route path="/checkout" element={<Checkout />} />
                                            <Route path="/order/:id" element={<Order />} />
                                            <Route path="/order/:id/success" element={<OrderSuccess />} />
                                            <Route path="/track" element={<Track />} />
                                            <Route path="/favorites" element={<Favorites />} />
                                            <Route path="/search" element={<Search />} />
                                            <Route path="/gift-box" element={<GiftBox />} />
                                            <Route path="/waves" element={<LoadDashboard />} />
                                            <Route path="/about" element={<About />} />
                                            <Route path="/account" element={<Account />} />
                                            <Route path="/verify-email" element={<VerifyEmail />} />
                                            <Route path="/privacy" element={<Privacy />} />
                                            <Route path="/offer" element={<Offer />} />
                                            <Route path="/admin">
                                                <Route index element={<AdminLogin />} />
                                                <Route element={<RequireAdmin />}>
                                                    <Route path="products" element={<AdminProducts />} />
                                                    <Route path="waves" element={<AdminWaves />} />
                                                    <Route path="orders" element={<AdminOrders />} />
                                                </Route>
                                            </Route>
                                            <Route path="*" element={<NotFound />} />
                                        </Routes>
                                    </main>
                                    <Footer />
                                </div>
                                <Toast />
                            </AdminProvider>
                        </CartProvider>
                    </AuthProvider>
                </FavoritesProvider>
            </ToastProvider>
        </BrowserRouter>
    )
}
