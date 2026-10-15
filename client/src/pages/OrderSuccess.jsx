import { Link, useLocation, useParams } from 'react-router-dom'
import { getOrder } from '../api/orders'
import ErrorMessage from '../components/ErrorMessage'
import { CheckIcon, CopyIcon } from '../components/Icons'
import Loader from '../components/Loader'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { formatDate, formatDateRange, formatRub } from '../utils/format'
import { DIRECTIONS } from '../utils/regions'

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text)
        return
    } catch {
    }

    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (!ok) throw new Error('copy failed')
}

export default function OrderSuccess() {
    const { id } = useParams()
    const location = useLocation()
    const { showToast } = useToast()
    const stateOrder = location.state?.order?.id === id ? location.state.order : null

    const fetched = useFetch((signal) => (stateOrder ? Promise.resolve(stateOrder) : getOrder(id, signal)), [id])
    const order = fetched.data

    useDocumentTitle(`Заказ №${id} оформлен`)

    if (fetched.loading && !order) {
        return (
            <div className="container section">
                <Loader label="Загружаем заказ…" />
            </div>
        )
    }

    if (fetched.error && !order) {
        return (
            <div className="container section">
                <ErrorMessage error={fetched.error} onRetry={fetched.reload} title="Не удалось загрузить заказ" />
            </div>
        )
    }

    const handleCopy = async () => {
        try {
            await copyText(order.id)
            showToast(`Номер ${order.id} скопирован`)
        } catch {
            showToast('Не удалось скопировать — выделите номер вручную', { type: 'error' })
        }
    }

    const direction = DIRECTIONS[order.direction]

    return (
        <div className="container section">
            <div className="success">
                <span className="success__icon" aria-hidden="true">
                    <CheckIcon size={36} />
                </span>
                <h1 className="success__title">Заказ №{order.id} оформлен</h1>
                <p className="success__lead">
                    {order.scenario === 'gift'
                        ? `Подарок для ${order.recipient.name} отправится волной «${direction.label}».`
                        : `Заказ отправится волной «${direction.label}».`}{' '}
                    {order.payment.status === 'paid' ? 'Оплата получена (имитация).' : 'Оплата — при получении.'}
                </p>

                <div className="success__number">
                    <span>
                        Номер заказа: <strong>{order.id}</strong>
                    </span>
                    <button type="button" className="btn btn--ghost btn--small" onClick={handleCopy}>
                        <CopyIcon size={18} /> Скопировать номер
                    </button>
                </div>

                {order.wave && (
                    <dl className="facts facts--center">
                        <div>
                            <dt>Волна</dt>
                            <dd>{direction.label}</dd>
                        </div>
                        <div>
                            <dt>Дата отправки</dt>
                            <dd>{formatDate(order.wave.departureDate, { withWeekday: true })}</dd>
                        </div>
                        <div>
                            <dt>Ожидаемое получение</dt>
                            <dd>{formatDateRange(order.expectedArrival.from, order.expectedArrival.to)}</dd>
                        </div>
                        <div>
                            <dt>Пункт выдачи</dt>
                            <dd>
                                {order.pickupPoint.city}, {order.pickupPoint.address}
                            </dd>
                        </div>
                        {order.totals.total !== undefined && (
                            <div>
                                <dt>Сумма (посчитана сервером)</dt>
                                <dd>
                                    {formatRub(order.totals.total)}, из них доставка {formatRub(order.totals.delivery.total)}
                                </dd>
                            </div>
                        )}
                    </dl>
                )}

                <p className="muted">
                    Итоговая цена доставки может снизиться, если волна заполнится сильнее — разницу вернём после закрытия
                    приёма заказов.
                </p>

                <div className="state__actions">
                    <Link to={`/order/${order.id}`} className="btn btn--primary">
                        Отслеживать заказ
                    </Link>
                    <Link to="/" className="btn btn--ghost">
                        На главную
                    </Link>
                </div>
            </div>
        </div>
    )
}
