import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct } from '../api/products'
import { getWaves } from '../api/waves'
import ErrorMessage from '../components/ErrorMessage'
import FavoriteButton from '../components/FavoriteButton'
import Loader from '../components/Loader'
import ProductPhoto from '../components/ProductPhoto'
import QuantityInput from '../components/QuantityInput'
import RegionBadge from '../components/RegionBadge'
import SeasonWarning from '../components/SeasonWarning'
import ShelfLifeWarning from '../components/ShelfLifeWarning'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { makeProductItem } from '../utils/cart'
import { checkShelfLife } from '../utils/delivery'
import { formatRub, formatWeight, pluralize, pricePer100g } from '../utils/format'
import { DIRECTIONS, REGIONS } from '../utils/regions'
import { ThermometerIcon } from '../components/Icons'

function splitDescription(text) {
    const index = text.indexOf('Состав:')
    if (index === -1) return { about: text, composition: '' }
    return { about: text.slice(0, index).trim(), composition: text.slice(index + 'Состав:'.length).trim() }
}

export default function Product() {
    const { id } = useParams()
    const { data: product, error, loading, reload } = useFetch((signal) => getProduct(id, signal), [id])

    useDocumentTitle(product?.name ?? 'Товар')

    if (loading && !product) {
        return (
            <div className="container section">
                <Loader label="Загружаем товар…" />
            </div>
        )
    }

    if (error && !product) {
        return (
            <div className="container section">
                {error.status === 404 ? (
                    <div className="state">
                        <p className="state__title">Товар не найден</p>
                        <p className="state__text">Возможно, его сняли с продажи. Посмотрите другие сладости.</p>
                        <div className="state__actions">
                            <Link to="/catalog/yakutia" className="btn btn--primary">
                                Сладости Якутии
                            </Link>
                            <Link to="/catalog/donbass" className="btn btn--primary">
                                Сладости Донбасса
                            </Link>
                        </div>
                    </div>
                ) : (
                    <ErrorMessage error={error} onRetry={reload} title="Не удалось загрузить товар" />
                )}
            </div>
        )
    }

    return <ProductView key={product.id} product={product} />
}

function ProductView({ product }) {
    const region = REGIONS[product.region]
    const direction = DIRECTIONS[region.direction]
    const [qty, setQty] = useState(1)
    const { addItem } = useCart()
    const favorites = useFavorites()
    const waves = useFetch((signal) => getWaves(region.direction, signal), [region.direction])

    const openWaves = waves.data ?? []
    const shelf = checkShelfLife(product.shelf_life_days, openWaves)
    const blocked = !shelf.canAdd
    const { about, composition } = splitDescription(product.description)

    const handleAdd = async () => {
        const added = await addItem(makeProductItem(product), qty)
        if (added) setQty(1)
    }

    return (
        <div className={`container section theme-${region.theme}`}>
            <nav className="breadcrumbs" aria-label="Хлебные крошки">
                <Link to="/">Главная</Link>
                <span aria-hidden="true">/</span>
                <Link to={`/catalog/${region.slug}`}>{region.title}</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{product.name}</span>
            </nav>

            <div className="product-page">
                <div className="product-page__media">
                    <ProductPhoto product={product} className="product-page__photo" eager />
                </div>

                <div className="product-page__info">
                    <div className="product-page__badges">
                        <RegionBadge region={product.region} />
                        <span className="tag tag--muted">{product.category}</span>
                        {product.temp_sensitive && (
                            <span className="tag tag--blue">
                                <ThermometerIcon size={13} />
                                чувствителен к температуре
                            </span>
                        )}
                    </div>

                    <p className="product-page__maker">{product.manufacturer}</p>
                    <h1 className="product-page__title">{product.name}</h1>

                    <div className="product-page__price">
                        <span className="product-page__price-value">{formatRub(product.price_rub)}</span>
                        <span className="muted">{pricePer100g(product.price_rub, product.weight_g)} за 100 г</span>
                    </div>

                    <dl className="facts">
                        <div>
                            <dt>Вес</dt>
                            <dd>{formatWeight(product.weight_g)}</dd>
                        </div>
                        <div>
                            <dt>Срок годности</dt>
                            <dd>
                                {product.shelf_life_days} {pluralize(product.shelf_life_days, ['день', 'дня', 'дней'])}
                            </dd>
                        </div>
                        <div>
                            <dt>Едет волной</dt>
                            <dd>{direction.label}</dd>
                        </div>
                        <div>
                            <dt>Артикул</dt>
                            <dd>{product.id}</dd>
                        </div>
                    </dl>

                    <div className="product-page__buy">
                        <QuantityInput value={qty} onChange={setQty} disabled={blocked} label="Количество" />
                        <button
                            type="button"
                            className="btn btn--primary btn--large"
                            onClick={handleAdd}
                            disabled={blocked}
                            aria-describedby={blocked ? 'shelf-life-warning' : undefined}
                        >
                            В корзину · {formatRub(product.price_rub * qty)}
                        </button>
                        <FavoriteButton
                            className="fav-button--bordered"
                            active={favorites.has(product.id)}
                            onToggle={() => favorites.toggle(product.id)}
                            name={product.name}
                        />
                    </div>

                    <div className="product-page__notices" id="shelf-life-warning">
                        {waves.loading && !waves.data && <Loader inline label="Проверяем ближайшую волну…" />}
                        {waves.error && !waves.data && (
                            <p className="inline-error" role="alert">
                                Не удалось загрузить расписание волн.{' '}
                                <button type="button" className="link-button" onClick={waves.reload}>
                                    Повторить
                                </button>
                            </p>
                        )}
                        {waves.data && <ShelfLifeWarning shelfLifeDays={product.shelf_life_days} waves={openWaves} />}
                        {waves.data && <SeasonWarning wave={openWaves[0]} tempSensitive={product.temp_sensitive} />}
                    </div>
                </div>
            </div>

            <div className="product-details">
                <section>
                    <h2 className="section-subtitle">Описание</h2>
                    <p>{about}</p>
                </section>
                {composition && (
                    <section>
                        <h2 className="section-subtitle">Состав</h2>
                        <p>{composition}</p>
                    </section>
                )}
                <section>
                    <h2 className="section-subtitle">Доставка</h2>
                    <p>
                        Товар едет сборной волной «{direction.label}» в {direction.toCity}. Волна уходит раз в 14 дней,
                        приём заказов закрывается за 3 дня до отправки, в пути 10–14 дней (в мае и ноябре — на 7 дней
                        дольше). Доставка — 500 ₽/кг со скидкой до 35 %, если волна заполнена.{' '}
                        <Link to="/about" className="link">
                            Подробнее о волнах
                        </Link>
                    </p>
                </section>
            </div>
        </div>
    )
}
