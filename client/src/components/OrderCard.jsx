import { Link } from 'react-router-dom'
import { formatDate, formatDateRange, formatDateTime, formatRub, pluralize } from '../utils/format'
import { DIRECTIONS, ORDER_STATUS_LABELS } from '../utils/regions'

export default function OrderCard({ order }) {
    const names = order.items.map((item) => `${item.name} × ${item.qty}`)
    const shown = names.slice(0, 2).join(', ')
    const rest = names.length - 2

    return (
        <li className="card my-order">
            <div className="my-order__head">
                <p className="my-order__title">Заказ №{order.id}</p>
                <span className={`status-pill status-pill--${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
            </div>
            <p className="my-order__meta">
                от {formatDateTime(order.createdAt)} · {DIRECTIONS[order.direction]?.label}
                {order.wave && ` · отправка ${formatDate(order.wave.departureDate)}`}
            </p>
            <p className="my-order__items">
                {shown}
                {rest > 0 && ` и ещё ${rest} ${pluralize(rest, ['позиция', 'позиции', 'позиций'])}`}
            </p>
            <div className="my-order__foot">
                <span>
                    {order.status !== 'received' && order.expectedArrival && (
                        <>
                            Получение: <strong>{formatDateRange(order.expectedArrival.from, order.expectedArrival.to)}</strong> ·{' '}
                        </>
                    )}
                    {order.pickupPoint?.name}
                </span>
                <span className="my-order__total">{formatRub(order.totals.total)}</span>
            </div>
            <Link to={`/order/${order.id}`} className="link my-order__link">
                Подробнее о заказе →
            </Link>
        </li>
    )
}
