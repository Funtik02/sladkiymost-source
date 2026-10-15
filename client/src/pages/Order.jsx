import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder } from '../api/orders'
import ErrorMessage from '../components/ErrorMessage'
import GiftCardPreview from '../components/GiftCardPreview'
import { GiftIcon, RefreshIcon } from '../components/Icons'
import Loader from '../components/Loader'
import RegionBadge from '../components/RegionBadge'
import StatusTimeline from '../components/StatusTimeline'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { formatDate, formatDateRange, formatDateTime, formatKg, formatRub } from '../utils/format'
import { DIRECTIONS, ORDER_STATUS_LABELS, WAVE_STATUS_LABELS } from '../utils/regions'

export default function Order() {
    const { isLoggedIn } = useAuth()
    const { id } = useParams()
    const { showToast } = useToast()
    const { data: order, error, loading, reload } = useFetch((signal) => getOrder(id, signal), [id])

    useDocumentTitle(`Заказ №${id}`)

    const refreshing = useRef(false)
    const handleRefresh = () => {
        refreshing.current = true
        reload()
    }

    useEffect(() => {
        if (loading || !refreshing.current) return
        refreshing.current = false

        if (error) showToast(error.message, { type: 'error' })
        else if (order) showToast(`Статус обновлён: ${ORDER_STATUS_LABELS[order.status].toLowerCase()}`, { type: 'info' })
    }, [loading, error, order, showToast])

    if (loading && !order) {
        return (
            <div className="container section">
                <Loader label="Ищем заказ…" />
            </div>
        )
    }

    if (error && !order) {
        return (
            <div className="container section narrow">
                {error.status === 404 ? (
                    <div className="state">
                        <p className="state__title">Заказ №{id} не найден</p>
                        <p className="state__text">Проверьте номер — он состоит из 6 цифр и есть на странице оформления.</p>
                        <Link to={isLoggedIn ? '/track' : '/'} className="btn btn--primary">
                            {isLoggedIn ? 'Ввести другой номер' : 'На главную'}
                        </Link>
                    </div>
                ) : (
                    <ErrorMessage error={error} onRetry={reload} title="Не удалось загрузить заказ" />
                )}
            </div>
        )
    }

    const direction = DIRECTIONS[order.direction]
    const lastPostponement = order.postponements[order.postponements.length - 1]

    return (
        <div className="container section">
            <nav className="breadcrumbs" aria-label="Хлебные крошки">
                {isLoggedIn ? <Link to="/track">Отслеживание</Link> : <Link to="/">Главная</Link>}
                <span aria-hidden="true">/</span>
                <span aria-current="page">Заказ №{order.id}</span>
            </nav>

            <div className="order-head">
                <div>
                    <h1 className="page-title">Заказ №{order.id}</h1>
                    <p className="muted">
                        Оформлен {formatDateTime(order.createdAt)} · {order.scenario === 'gift' ? 'подарок' : 'заказ себе'}
                    </p>
                </div>
                <div className="order-head__status">
                    <span className={`status-pill status-pill--${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleRefresh} disabled={loading}>
                        <RefreshIcon size={18} /> {loading ? 'Обновляем…' : 'Обновить статус'}
                    </button>
                </div>
            </div>

            {lastPostponement && (
                <div className="notice notice--danger notice--big" role="status">
                    <p className="notice__title">Волна перенесена</p>
                    <p>
                        Отправка была назначена на {formatDate(lastPostponement.from)}, но {lastPostponement.reason}. Новая
                        дата отправки — <strong>{formatDate(order.wave?.departureDate ?? lastPostponement.to)}</strong>
                        {order.expectedArrival &&
                            `, получение ожидается ${formatDateRange(order.expectedArrival.from, order.expectedArrival.to)}`}
                        .
                    </p>
                </div>
            )}

            <section className="card" aria-label="Статус заказа">
                <StatusTimeline status={order.status} history={order.statusHistory} />
            </section>

            <div className="order-grid">
                <section className={`card ${order.scenario === 'gift' ? '' : 'order-grid__wide'}`}>
                    <h2 className="section-subtitle">Доставка</h2>
                    <dl className="facts facts--stack">
                        <div>
                            <dt>Волна</dt>
                            <dd>
                                {direction.label}
                                {order.wave && ` · ${WAVE_STATUS_LABELS[order.wave.status] ?? order.wave.status}`}
                            </dd>
                        </div>
                        {order.wave && (
                            <div>
                                <dt>Отправка</dt>
                                <dd>
                                    {formatDate(order.wave.departureDate, { withWeekday: true })} (приём заказов до{' '}
                                    {formatDate(order.wave.cutoffDate)})
                                </dd>
                            </div>
                        )}
                        {order.expectedArrival && (
                            <div>
                                <dt>Ожидаемое получение</dt>
                                <dd>{formatDateRange(order.expectedArrival.from, order.expectedArrival.to)}</dd>
                            </div>
                        )}
                        <div>
                            <dt>Пункт выдачи</dt>
                            <dd>
                                {order.pickupPoint.name}, {order.pickupPoint.city}, {order.pickupPoint.address}
                                <br />
                                <span className="muted">{order.pickupPoint.hours}</span>
                            </dd>
                        </div>
                        <div>
                            <dt>{order.scenario === 'gift' ? 'Получатель' : 'Покупатель'}</dt>
                            <dd>
                                {order.scenario === 'gift'
                                    ? `${order.recipient.name}, ${order.recipient.phone}`
                                    : `${order.customer.name}, ${order.customer.phone}`}
                            </dd>
                        </div>
                        {order.scenario === 'gift' && (
                            <div>
                                <dt>Отправитель</dt>
                                <dd>{order.customer.name}</dd>
                            </div>
                        )}
                    </dl>
                </section>

                {order.scenario === 'gift' && (
                    <section className="card">
                        <h2 className="section-subtitle">Открытка</h2>
                        <GiftCardPreview
                            design={order.gift.cardDesign}
                            text={order.gift.cardText}
                            from={order.customer.name}
                            to={order.recipient.name}
                        />
                    </section>
                )}

                <section className="card order-grid__wide">
                    <h2 className="section-subtitle">Состав заказа</h2>
                    <ul className="order-items">
                        {order.items.map((item, index) => (
                            <li key={item.productId ?? `box-${index}`} className="order-items__row">
                                <div>
                                    <p className="order-items__name">
                                        {item.type === 'giftBox' && <GiftIcon size={16} className="inline-icon" />}
                                        {item.name} × {item.qty}
                                    </p>
                                    {item.type === 'giftBox' ? (
                                        <ul className="order-items__contents">
                                            {item.contents.map((c) => (
                                                <li key={c.productId}>
                                                    <RegionBadge region={c.region} small /> {c.name}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="muted">{item.manufacturer}</p>
                                    )}
                                </div>
                                {!order.pricesHidden && <span className="order-items__price">{formatRub(item.lineTotal)}</span>}
                            </li>
                        ))}
                    </ul>

                    {order.pricesHidden ? (
                        <p className="notice notice--info">
                            Отправитель попросил не показывать цену подарка. Вес посылки — {formatKg(order.totals.weightKg)}.
                        </p>
                    ) : (
                        <dl className="summary__list summary__list--totals">
                            <div>
                                <dt>Товары</dt>
                                <dd>{formatRub(order.totals.goods)}</dd>
                            </div>
                            <div>
                                <dt>
                                    Доставка ({formatKg(order.totals.weightKg)}
                                    {order.totals.delivery.discount > 0 && `, скидка ${order.totals.delivery.discount * 100} %`}
                                    {order.totals.delivery.thermoApplied && ', с термоупаковкой'})
                                </dt>
                                <dd>{formatRub(order.totals.delivery.total)}</dd>
                            </div>
                            <div className="summary__total">
                                <dt>Итого · {order.payment.status === 'paid' ? 'оплачено картой' : 'оплата при получении'}</dt>
                                <dd>{formatRub(order.totals.total)}</dd>
                            </div>
                        </dl>
                    )}
                </section>
            </div>
        </div>
    )
}
