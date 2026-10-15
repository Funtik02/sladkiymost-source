import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminOrders, setOrderStatus } from '../../api/admin'
import ErrorMessage from '../../components/ErrorMessage'
import GiftCardPreview from '../../components/GiftCardPreview'
import Loader from '../../components/Loader'
import Modal from '../../components/Modal'
import RegionBadge from '../../components/RegionBadge'
import StatusTimeline from '../../components/StatusTimeline'
import { useAdmin } from '../../context/AdminContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useFetch } from '../../hooks/useFetch'
import { formatDate, formatDateTime, formatKg, formatRub } from '../../utils/format'
import { DIRECTIONS, ORDER_STATUS_LABELS, ORDER_STATUSES } from '../../utils/regions'
import { formatPhone } from '../../utils/validation'
import { GiftIcon } from '../../components/Icons'

const nextStatus = (status) => ORDER_STATUSES[ORDER_STATUSES.indexOf(status) + 1] ?? null

function useAnalytics(orders) {
    return useMemo(() => {
        const sold = new Map()
        const add = (id, name, qty) => {
            const entry = sold.get(id) ?? { id, name, qty: 0 }
            entry.qty += qty
            sold.set(id, entry)
        }

        for (const order of orders) {
            for (const item of order.items) {
                if (item.type === 'giftBox') item.contents.forEach((c) => add(c.productId, c.name, item.qty))
                else add(item.productId, item.name, item.qty)
            }
        }

        const revenue = orders.reduce((sum, o) => sum + o.totals.total, 0)

        return {
            count: orders.length,
            average: orders.length ? revenue / orders.length : 0,
            top: [...sold.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
        }
    }, [orders])
}

function OrderDetails({ order }) {
    return (
        <div className="order-details">
            <StatusTimeline status={order.status} history={order.statusHistory} />

            {order.postponements.length > 0 && (
                <div className="notice notice--warning">
                    {order.postponements.map((p) => (
                        <p key={p.at}>
                            Перенос {formatDate(p.from)} → {formatDate(p.to)}: {p.reason}
                        </p>
                    ))}
                </div>
            )}

            <dl className="facts facts--stack">
                <div>
                    <dt>{order.scenario === 'gift' ? 'Отправитель' : 'Покупатель'}</dt>
                    <dd>
                        {order.customer.name}, <a href={`tel:${order.customer.phone}`}>{formatPhone(order.customer.phone)}</a>,{' '}
                        <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
                    </dd>
                </div>
                {order.recipient && (
                    <div>
                        <dt>Получатель</dt>
                        <dd>
                            {order.recipient.name}, <a href={`tel:${order.recipient.phone}`}>{formatPhone(order.recipient.phone)}</a>
                        </dd>
                    </div>
                )}
                <div>
                    <dt>Пункт выдачи</dt>
                    <dd>
                        {order.pickupPoint.name}, {order.pickupPoint.city}, {order.pickupPoint.address}
                    </dd>
                </div>
                <div>
                    <dt>Волна</dt>
                    <dd>
                        {DIRECTIONS[order.direction].label}
                        {order.wave && `, отправка ${formatDate(order.wave.departureDate)}`}
                    </dd>
                </div>
                <div>
                    <dt>Оплата</dt>
                    <dd>
                        {order.payment.label} — {order.payment.status === 'paid' ? 'оплачено' : 'при получении'}
                    </dd>
                </div>
            </dl>

            <h3 className="section-subtitle">Состав</h3>
            <ul className="order-items">
                {order.items.map((item, index) => (
                    <li key={item.productId ?? `box-${index}`} className="order-items__row">
                        <div>
                            <p className="order-items__name">
                                {item.name} × {item.qty}
                            </p>
                            {item.type === 'giftBox' && (
                                <ul className="order-items__contents">
                                    {item.contents.map((c) => (
                                        <li key={c.productId}>
                                            <RegionBadge region={c.region} small /> {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <span className="order-items__price">{formatRub(item.lineTotal)}</span>
                    </li>
                ))}
            </ul>
            <p>
                Товары {formatRub(order.totals.goods)} + доставка {formatRub(order.totals.delivery.total)} (
                {formatKg(order.totals.weightKg)}, скидка {order.totals.delivery.discount * 100} %, термоупаковка{' '}
                {order.totals.delivery.thermoApplied ? 'да' : 'нет'}) = <strong>{formatRub(order.totals.total)}</strong>
            </p>

            {order.gift && (
                <>
                    <h3 className="section-subtitle">
                        Открытка{order.gift.hidePrice && ' · цена скрыта от получателя'}
                    </h3>
                    <GiftCardPreview
                        design={order.gift.cardDesign}
                        text={order.gift.cardText}
                        from={order.customer.name}
                        to={order.recipient.name}
                    />
                </>
            )}

            <Link to={`/order/${order.id}`} className="link">
                Открыть страницу отслеживания →
            </Link>
        </div>
    )
}

export default function AdminOrders() {
    useDocumentTitle('Админка: заказы')
    const { call } = useAdmin()
    const { showToast } = useToast()
    const { data, error, loading, reload, setData } = useFetch((signal) => call(getAdminOrders, signal), [])
    const [waveFilter, setWaveFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [details, setDetails] = useState(null)
    const [updatingId, setUpdatingId] = useState(null)
    const orders = data ?? []
    const analytics = useAnalytics(orders)

    if (loading && !data) return <Loader label="Загружаем заказы…" />
    if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

    const waveOptions = [...new Map(orders.filter((o) => o.wave).map((o) => [o.wave.id, o.wave])).values()].sort(
        (a, b) => a.direction.localeCompare(b.direction) || a.departureDate.localeCompare(b.departureDate)
    )

    const visible = orders.filter(
        (o) => (!waveFilter || o.waveId === waveFilter) && (!statusFilter || o.status === statusFilter)
    )

    const advance = async (order) => {
        const status = nextStatus(order.status)
        setUpdatingId(order.id)
        try {
            const updated = await call(setOrderStatus, order.id, status)
            setData((list) => list.map((o) => (o.id === updated.id ? updated : o)))
            if (details?.id === updated.id) setDetails(updated)
            showToast(`Заказ ${order.id}: ${ORDER_STATUS_LABELS[status].toLowerCase()}`)
        } catch (err) {
            showToast(err.message, { type: 'error' })
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <section aria-labelledby="orders-title">
            <h2 id="orders-title" className="visually-hidden">
                Заказы
            </h2>

            <div className="stats">
                <div className="stat">
                    <span className="stat__label">Заказов</span>
                    <span className="stat__value">{analytics.count}</span>
                </div>
                <div className="stat">
                    <span className="stat__label">Средний чек</span>
                    <span className="stat__value">{formatRub(analytics.average)}</span>
                </div>
                <div className="stat stat--wide">
                    <span className="stat__label">Топ-5 товаров, шт.</span>
                    <ol className="stat__top">
                        {analytics.top.map((p) => (
                            <li key={p.id}>
                                <span>{p.name}</span> <b>{p.qty}</b>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            <div className="admin__toolbar">
                <div className="field">
                    <label className="field__label" htmlFor="orders-wave">
                        Волна
                    </label>
                    <select id="orders-wave" className="field__control" value={waveFilter} onChange={(e) => setWaveFilter(e.target.value)}>
                        <option value="">Все волны</option>
                        {waveOptions.map((w) => (
                            <option key={w.id} value={w.id}>
                                {DIRECTIONS[w.direction].label} · {formatDate(w.departureDate)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="orders-status">
                        Статус
                    </label>
                    <select id="orders-status" className="field__control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Все статусы</option>
                        {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {ORDER_STATUS_LABELS[s]}
                            </option>
                        ))}
                    </select>
                </div>
                <p className="muted admin__count">Показано: {visible.length}</p>
                <button type="button" className="btn btn--ghost btn--small" onClick={reload} disabled={loading}>
                    {loading ? 'Обновляем…' : 'Обновить'}
                </button>
            </div>

            <div className="table-wrap" tabIndex={0} aria-label="Таблица заказов, прокручивается горизонтально">
                <table className="table">
                    <thead>
                        <tr>
                            <th scope="col">№</th>
                            <th scope="col">Создан</th>
                            <th scope="col">Покупатель</th>
                            <th scope="col">Волна</th>
                            <th scope="col">Вес</th>
                            <th scope="col">Сумма</th>
                            <th scope="col">Статус</th>
                            <th scope="col">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((order) => {
                            const next = nextStatus(order.status)
                            return (
                                <tr key={order.id}>
                                    <td className="nowrap">
                                        {order.id}
                                        {order.scenario === 'gift' && (
                                            <span className="inline-icon" title="Подарок">
                                                <GiftIcon size={15} />
                                            </span>
                                        )}
                                    </td>
                                    <td className="nowrap">{formatDateTime(order.createdAt)}</td>
                                    <td>{order.customer.name}</td>
                                    <td className="nowrap">
                                        {DIRECTIONS[order.direction].label}
                                        <br />
                                        <span className="muted">{order.wave ? formatDate(order.wave.departureDate) : '—'}</span>
                                        {order.postponements.length > 0 && <span className="tag tag--red">перенос</span>}
                                    </td>
                                    <td className="nowrap">{formatKg(order.totals.weightKg)}</td>
                                    <td className="nowrap">{formatRub(order.totals.total)}</td>
                                    <td>
                                        <span className={`status-pill status-pill--${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                                    </td>
                                    <td className="nowrap">
                                        {next && (
                                            <button
                                                type="button"
                                                className="btn btn--primary btn--small"
                                                onClick={() => advance(order)}
                                                disabled={updatingId === order.id}
                                            >
                                                → {ORDER_STATUS_LABELS[next]}
                                            </button>
                                        )}{' '}
                                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setDetails(order)}>
                                            Подробнее
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={8} className="table__empty">
                                    Заказов с такими условиями нет
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal open={Boolean(details)} title={details ? `Заказ №${details.id}` : ''} onClose={() => setDetails(null)} size="lg">
                {details && (
                    <>
                        <OrderDetails order={details} />
                        {nextStatus(details.status) && (
                            <div className="confirm__actions">
                                <button
                                    type="button"
                                    className="btn btn--primary"
                                    onClick={() => advance(details)}
                                    disabled={updatingId === details.id}
                                >
                                    Перевести в «{ORDER_STATUS_LABELS[nextStatus(details.status)]}»
                                </button>
                            </div>
                        )}
                    </>
                )}
            </Modal>
        </section>
    )
}
