import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProducts } from '../api/products'
import { getWavesLoad } from '../api/waves'
import DeliveryBreakdown from '../components/DeliveryBreakdown'
import ErrorMessage from '../components/ErrorMessage'
import { CloseIcon } from '../components/Icons'
import Loader from '../components/Loader'
import ProductPhoto from '../components/ProductPhoto'
import RegionBadge from '../components/RegionBadge'
import ThermoBadge from '../components/ThermoBadge'
import { useCart } from '../context/CartContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { makeGiftBoxItem } from '../utils/cart'
import { calcDelivery, checkShelfLife, getExpectedArrival, getWaveBlocker } from '../utils/delivery'
import { formatDate, formatDateRange, formatRub, formatWeight } from '../utils/format'
import { GIFT_BOX_MAX_ITEMS } from '../utils/gift'
import { DIRECTIONS, REGIONS, directionToRegion } from '../utils/regions'

const REGION_NAMES = ['Якутия', 'ДНР']

export default function GiftBox() {
    useDocumentTitle('Набор «Север + Юг»')
    const { data, error, loading, reload } = useFetch(
        (signal) =>
            Promise.all([
                getProducts({ region: 'Якутия', sort: 'popular' }, signal),
                getProducts({ region: 'ДНР', sort: 'popular' }, signal),
                getWavesLoad(signal),
            ]),
        []
    )

    return (
        <div className="container section">
            <h1 className="page-title">Набор «Север + Юг»</h1>
            <p className="page-lead">
                Соберите подарочную коробку из сладостей двух регионов: хотя бы одна позиция из Якутии и одна из
                Донбасса, всего до {GIFT_BOX_MAX_ITEMS} позиций.
            </p>

            {loading && !data && <Loader label="Загружаем сладости…" />}
            {error && !data && <ErrorMessage error={error} onRetry={reload} />}
            {data && <GiftBoxBuilder products={{ Якутия: data[0], ДНР: data[1] }} wavesByDirection={data[2]} />}
        </div>
    )
}

function GiftBoxBuilder({ products, wavesByDirection }) {
    const [destination, setDestination] = useState('ДНР')
    const [selectedIds, setSelectedIds] = useState([])
    const [adding, setAdding] = useState(false)
    const { addItem } = useCart()
    const navigate = useNavigate()

    const directionCode = directionToRegion(destination)
    const direction = DIRECTIONS[directionCode]
    const waves = wavesByDirection[directionCode] ?? []
    const otherRegion = REGIONS[direction.fromRegion]
    const allProducts = [...products['Якутия'], ...products['ДНР']]
    const selected = selectedIds.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean)
    const counts = Object.fromEntries(REGION_NAMES.map((r) => [r, selected.filter((p) => p.region === r).length]))
    const isFull = selected.length >= GIFT_BOX_MAX_ITEMS

    const problems = []
    if (counts['Якутия'] === 0) problems.push('Добавьте хотя бы одну сладость из Якутии')
    if (counts['ДНР'] === 0) problems.push('Добавьте хотя бы одну сладость из Донбасса')

    const box = selected.length > 0 ? makeGiftBoxItem(selected, destination, 'preview') : null
    const wave = box ? waves.find((w) => !getWaveBlocker([box], w)) : waves[0]
    const calc = box && wave ? calcDelivery({ items: [box], wave }) : null
    const arrival = wave ? getExpectedArrival(wave) : null

    if (box && !wave) problems.push('Нет открытой волны, с которой этот набор успеет доехать')

    const toggle = (id) => {
        setSelectedIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
    }

    const handleAdd = async () => {
        setAdding(true)
        const added = await addItem(makeGiftBoxItem(selected, destination))
        setAdding(false)
        if (added) navigate('/cart')
    }

    return (
        <div className="giftbox">
            <div className="giftbox__main">
                <fieldset className="card">
                    <legend className="section-subtitle">1. Куда отправить набор</legend>
                    <div className="dest-options">
                        {REGION_NAMES.map((region) => (
                            <label
                                key={region}
                                className={`dest-option theme-${REGIONS[region].theme} ${destination === region ? 'dest-option--active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="destination"
                                    value={region}
                                    checked={destination === region}
                                    onChange={() => setDestination(region)}
                                />
                                <span>
                                    <strong>
                                        {region === 'Якутия' ? 'В Якутию' : 'В Донбасс'} — {REGIONS[region].city}
                                    </strong>
                                    <span className="dest-option__text">волна «{DIRECTIONS[directionToRegion(region)].label}»</span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="notice notice--info">
                        <p className="notice__title">Как едет такой набор</p>
                        <p>
                            Набор собирается на складе в городе {direction.toCity}. Сладости из {otherRegion.genitive} едут
                            туда волной «{direction.label}», а местные сладости добавляются на складе. Поэтому набор будет
                            готов к выдаче к дате прибытия этой волны — по сроку более поздней части набора. Это допущение
                            нашей команды: так коробку не приходится возить туда и обратно.
                        </p>
                    </div>
                </fieldset>

                <section className="card" aria-labelledby="pick-title">
                    <h2 id="pick-title" className="section-subtitle">
                        2. Выберите сладости ({selected.length} из {GIFT_BOX_MAX_ITEMS})
                    </h2>
                    <div className="pick-columns">
                        {REGION_NAMES.map((region) => (
                            <div key={region} className={`pick-column theme-${REGIONS[region].theme}`}>
                                <h3 className="pick-column__title">
                                    <RegionBadge region={region} /> {REGIONS[region].title}
                                </h3>
                                <ul className="pick-list">
                                    {products[region].map((product) => {
                                        const isSelected = selectedIds.includes(product.id)
                                        const shelf = checkShelfLife(product.shelf_life_days, waves)
                                        const disabled = !isSelected && (isFull || !shelf.canAdd)

                                        return (
                                            <li key={product.id} className={`pick-item ${isSelected ? 'pick-item--selected' : ''}`}>
                                                <ProductPhoto product={product} className="pick-item__photo" />
                                                <div className="pick-item__info">
                                                    <Link to={`/product/${product.id}`} className="pick-item__name">
                                                        {product.name}
                                                    </Link>
                                                    <span className="pick-item__meta">
                                                        {formatWeight(product.weight_g)} · {formatRub(product.price_rub)}
                                                        {product.temp_sensitive && <ThermoBadge />}
                                                    </span>
                                                    {!shelf.canAdd && (
                                                        <span className="pick-item__note">
                                                            срок годности {product.shelf_life_days} дн. — не доедет
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`btn btn--small ${isSelected ? 'btn--ghost' : 'btn--primary'}`}
                                                    onClick={() => toggle(product.id)}
                                                    disabled={disabled}
                                                    aria-pressed={isSelected}
                                                    aria-label={`${isSelected ? 'Убрать из набора' : 'Добавить в набор'}: ${product.name}`}
                                                >
                                                    {isSelected ? 'Убрать' : 'В набор'}
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <aside className="giftbox__aside">
                <div className="card summary">
                    <h2 className="section-subtitle">Ваша коробка</h2>
                    {selected.length === 0 ? (
                        <p className="summary__placeholder">
                            Пока пусто. Добавьте сладости из обоих регионов — до {GIFT_BOX_MAX_ITEMS} позиций.
                        </p>
                    ) : (
                        <ul className="box-list">
                            {selected.map((product) => (
                                <li key={product.id}>
                                    <RegionBadge region={product.region} small />
                                    <span className="box-list__name">{product.name}</span>
                                    <button
                                        type="button"
                                        className="icon-button"
                                        onClick={() => toggle(product.id)}
                                        aria-label={`Убрать из набора: ${product.name}`}
                                    >
                                        <CloseIcon size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <p className="box-counts">
                        Якутия: {counts['Якутия']} · Донбасс: {counts['ДНР']} · всего {selected.length} из {GIFT_BOX_MAX_ITEMS}
                    </p>

                    {box && (
                        <dl className="summary__list">
                            <div>
                                <dt>Цена набора</dt>
                                <dd>{formatRub(box.price_rub)}</dd>
                            </div>
                            <div>
                                <dt>Вес</dt>
                                <dd>{formatWeight(box.weight_g)}</dd>
                            </div>
                        </dl>
                    )}

                    {calc && (
                        <>
                            <p className="summary__wave">
                                Волна «{direction.label}», отправка {formatDate(wave.departureDate)} · готов к выдаче{' '}
                                {formatDateRange(arrival.from, arrival.to)}
                            </p>
                            <DeliveryBreakdown calc={calc} goodsTotal={box.price_rub} goodsLabel="Набор" />
                        </>
                    )}

                    {problems.length > 0 && selected.length > 0 && (
                        <ul className="box-problems" aria-live="polite">
                            {problems.map((p) => (
                                <li key={p}>{p}</li>
                            ))}
                        </ul>
                    )}

                    <button
                        type="button"
                        className="btn btn--primary btn--large btn--block"
                        onClick={handleAdd}
                        disabled={selected.length === 0 || problems.length > 0 || adding}
                    >
                        Оформить набор
                    </button>
                    <p className="summary__hint">
                        Набор попадёт в корзину одной позицией; волну отправки можно будет выбрать там.
                    </p>
                </div>
            </aside>
        </div>
    )
}
