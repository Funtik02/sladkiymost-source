import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProductsByIds } from '../api/products'
import { getWavesLoad } from '../api/waves'
import ErrorMessage from '../components/ErrorMessage'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import { useFavorites } from '../context/FavoritesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { directionFromRegion } from '../utils/regions'

export default function Favorites() {
    useDocumentTitle('Избранное')
    const { ids, keepOnly } = useFavorites()

    const { data, error, loading, reload } = useFetch(
        (signal) => Promise.all([getProductsByIds(ids, signal), getWavesLoad(signal)]),
        []
    )

    useEffect(() => {
        if (data) keepOnly(data[0].map((p) => p.id))
    }, [data, keepOnly])

    if (ids.length === 0) {
        return (
            <div className="container section">
                <h1 className="page-title">Избранное</h1>
                <div className="state">
                    <p className="state__title">Здесь пока ничего нет</p>
                    <p className="state__text">Нажимайте на сердечко на карточках товаров, чтобы не потерять понравившиеся сладости.</p>
                    <div className="state__actions">
                        <Link to="/catalog/yakutia" className="btn btn--primary">
                            Сладости Якутии
                        </Link>
                        <Link to="/catalog/donbass" className="btn btn--primary">
                            Сладости Донбасса
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const products = data ? ids.map((id) => data[0].find((p) => p.id === id)).filter(Boolean) : []

    return (
        <div className="container section">
            <h1 className="page-title">Избранное</h1>
            {loading && !data && <Loader label="Загружаем избранное…" />}
            {error && !data && <ErrorMessage error={error} onRetry={reload} />}
            {data && (
                <div className="product-grid">
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            waves={data[1][directionFromRegion(product.region)]}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
