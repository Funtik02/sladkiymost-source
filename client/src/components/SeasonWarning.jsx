import { getDeliveryDays, THERMO_PRICE } from '../utils/delivery'
import { formatDate } from '../utils/format'
import { getMonthFromISO, getSeason } from '../utils/season'

export default function SeasonWarning({ wave, tempSensitive = false }) {
    if (!wave) return null

    const month = getMonthFromISO(wave.departureDate)
    const season = getSeason(month)
    const days = getDeliveryDays(month)
    const date = formatDate(wave.departureDate)

    if (season.thermoRequired) {
        return (
            <div className={`notice ${tempSensitive ? 'notice--warning' : 'notice--info'}`}>
                <p className="notice__title">
                    {season.label}: отправка {date}
                </p>
                <p>
                    {tempSensitive
                        ? `Термочувствительные товары в эту волну едут только в термоупаковке (+${THERMO_PRICE} ₽ к заказу) — ${season.reason}.`
                        : 'Термоупаковка обязательна только для термочувствительных товаров — к этому заказу она не требуется.'}
                </p>
            </div>
        )
    }

    if (season.extraDays > 0) {
        return (
            <div className="notice notice--warning">
                <p className="notice__title">Межсезонье: отправка {date}</p>
                <p>
                    Срок доставки увеличен на {season.extraDays} дней — {days.min}–{days.max} дней вместо обычных 10–14.
                </p>
            </div>
        )
    }

    return (
        <div className="notice notice--info">
            <p className="notice__title">Ближайшая отправка {date}</p>
            <p>Сезонных ограничений нет: доставка {days.min}–{days.max} дней, термоупаковка — по желанию.</p>
        </div>
    )
}
