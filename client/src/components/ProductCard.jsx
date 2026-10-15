import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { makeProductItem } from '../utils/cart'
import { checkShelfLife } from '../utils/delivery'
import { formatRub, formatWeight, pricePer100g } from '../utils/format'
import { REGIONS } from '../utils/regions'
import FavoriteButton from './FavoriteButton'
import ProductPhoto from './ProductPhoto'
import RegionBadge from './RegionBadge'
import ThermoBadge from './ThermoBadge'

export default function ProductCard({ product, waves }) {
    const { addItem } = useCart()
    const favorites = useFavorites()
    const theme = REGIONS[product.region]?.theme ?? 'yakutia'
    const shelf = checkShelfLife(product.shelf_life_days, waves)
    const link = `/product/${product.id}`

    return (
        <article className={`product-card theme-${theme}`}>
            <div className="product-card__media">
                <Link to={link} tabIndex={-1} aria-hidden="true">
                    <ProductPhoto product={product} className="product-card__photo" />
                </Link>
                <div className="product-card__badges">
                    <RegionBadge region={product.region} small />
                    {product.temp_sensitive && <ThermoBadge />}
                </div>
                <FavoriteButton
                    className="product-card__fav"
                    active={favorites.has(product.id)}
                    onToggle={() => favorites.toggle(product.id)}
                    name={product.name}
                />
            </div>

            <div className="product-card__body">
                <p className="product-card__maker">
                    {product.manufacturer} · {product.category}
                </p>
                <h3 className="product-card__title">
                    <Link to={link}>{product.name}</Link>
                </h3>
                <p className="product-card__meta">
                    {formatWeight(product.weight_g)} · {pricePer100g(product.price_rub, product.weight_g)} за 100 г
                </p>

                <div className="product-card__footer">
                    <span className="product-card__price">{formatRub(product.price_rub)}</span>
                    <button
                        type="button"
                        className="btn btn--primary btn--small"
                        onClick={() => addItem(makeProductItem(product))}
                        disabled={!shelf.canAdd}
                        aria-label={shelf.canAdd ? `Добавить «${product.name}» в корзину` : undefined}
                    >
                        {shelf.canAdd ? 'В корзину' : 'Не доедет'}
                    </button>
                </div>
                {!shelf.canAdd && (
                    <p className="product-card__note">
                        Срок годности {product.shelf_life_days} дн. — меньше нужных {shelf.requiredDays} дн. для доставки волной
                    </p>
                )}
            </div>
        </article>
    )
}
