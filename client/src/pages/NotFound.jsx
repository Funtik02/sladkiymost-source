import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
    useDocumentTitle('Страница не найдена')

    return (
        <div className="container section">
            <div className="state state--big">
                <p className="state__code" aria-hidden="true">
                    404
                </p>
                <h1 className="state__title">Такой страницы нет</h1>
                <p className="state__text">Похоже, ссылка устарела или в адресе опечатка.</p>
                <Link to="/" className="btn btn--primary">
                    На главную
                </Link>
            </div>
        </div>
    )
}
