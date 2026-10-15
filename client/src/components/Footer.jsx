import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoMark from './Logo'

export default function Footer() {
    const { isLoggedIn } = useAuth()

    return (
        <footer className="footer">
            <div className="container footer__inner">
                <div className="footer__about">
                    <p className="footer__logo">
                        <LogoMark className="footer__logo-mark" />
                        сладкий мост
                    </p>
                    <p>
                        Маркетплейс кондитерских изделий Якутии и Донбасса. Доставляем сборными партиями —
                        волнами раз в 14 дней в каждом направлении.
                    </p>
                </div>

                <nav aria-label="Разделы сайта">
                    <p className="footer__heading">Разделы</p>
                    <ul className="footer__list">
                        <li><Link to="/catalog/yakutia">Сладости Якутии</Link></li>
                        <li><Link to="/catalog/donbass">Сладости Донбасса</Link></li>
                        <li><Link to="/gift-box">Набор «Север + Юг»</Link></li>
                        <li><Link to="/waves">Загрузка волн</Link></li>
                        {isLoggedIn && <li><Link to="/track">Отследить заказ</Link></li>}
                    </ul>
                </nav>

                <div>
                    <p className="footer__heading">Контакты</p>
                    <ul className="footer__list">
                        <li><a href="mailto:ndanilov40@gmail.com">ndanilov40@gmail.com</a></li>
                        <li><a href="tel:+79627454777">+7 962 745-47-77</a></li>
                        <li><Link to="/about">О проекте и правилах доставки</Link></li>
                        <li><Link to="/offer">Публичная оферта</Link></li>
                        <li><Link to="/privacy">Политика конфиденциальности</Link></li>
                        <li><Link to="/admin">Вход для администратора</Link></li>
                    </ul>
                </div>
            </div>
            <div className="container footer__partners">
                <span className="footer__partner">
                    <img
                        src="/partners/kr-yakutia.png"
                        alt="Корпорация развития Республики Саха (Якутия)"
                        width="1327"
                        height="245"
                        loading="lazy"
                    />
                </span>
            </div>
            <div className="container footer__bottom">
                <span>© 2026 «Сладкий мост». Проект хакатона.</span>
                <span>Оплата картой на сайте — имитация.</span>
            </div>
        </footer>
    )
}
