import { Link } from 'react-router-dom'
import { getDiscount, getExpectedArrival, getTariffPerKg } from '../utils/delivery'
import { formatDate, formatDateRange, formatKg, formatPercent } from '../utils/format'
import { DIRECTIONS } from '../utils/regions'
import { getWaveSeason } from '../utils/season'
import WaveLoadBar from './WaveLoadBar'

export default function WaveInfo({ direction, wave, compact = false }) {
    const label = DIRECTIONS[direction].label

    if (!wave) {
        return (
            <div className={`wave-info ${compact ? 'wave-info--compact' : ''}`}>
                <p className="wave-info__direction">{label}</p>
                <p className="muted">Открытых волн пока нет — расписание скоро обновится.</p>
            </div>
        )
    }

    const fill = wave.currentWeightKg / wave.maxWeightKg
    const discount = getDiscount(fill)
    const season = getWaveSeason(wave)
    const arrival = getExpectedArrival(wave)

    if (compact) {
        return (
            <div className="wave-info wave-info--compact">
                <div className="wave-info__row">
                    <p>
                        <span className="wave-info__direction">{label}:</span> ближайшая отправка{' '}
                        <strong>{formatDate(wave.departureDate)}</strong>, приём заказов до{' '}
                        <strong>{formatDate(wave.cutoffDate)}</strong>
                    </p>
                    <Link to="/waves" className="link">
                        Все волны →
                    </Link>
                </div>
                <WaveLoadBar currentKg={wave.currentWeightKg} maxKg={wave.maxWeightKg} label={`Загрузка волны ${label}`} />
                <p className="wave-info__stats">
                    Заполнено {formatPercent(fill)} ({formatKg(wave.currentWeightKg)} из {wave.maxWeightKg} кг) · тариф сейчас{' '}
                    {getTariffPerKg(fill)} ₽/кг{discount > 0 && ` (−${discount * 100} %)`}
                    {season.key !== 'calm' && ` · ${season.label.toLowerCase()}`}
                </p>
            </div>
        )
    }

    return (
        <div className="wave-info">
            <p className="wave-info__direction">{label}</p>
            <p className="wave-info__date">{formatDate(wave.departureDate, { withWeekday: true })}</p>
            <p className="wave-info__cutoff">
                Приём заказов до <strong>{formatDate(wave.cutoffDate)}</strong>
            </p>
            <WaveLoadBar currentKg={wave.currentWeightKg} maxKg={wave.maxWeightKg} showScale label={`Загрузка волны ${label}`} />
            <dl className="wave-info__facts">
                <div>
                    <dt>Заполнено</dt>
                    <dd>
                        {formatPercent(fill)} · {formatKg(wave.currentWeightKg)}
                    </dd>
                </div>
                <div>
                    <dt>Тариф сейчас</dt>
                    <dd>
                        {getTariffPerKg(fill)} ₽/кг{discount > 0 && <span className="tag tag--red">−{discount * 100} %</span>}
                    </dd>
                </div>
                <div>
                    <dt>Прибытие</dt>
                    <dd>{formatDateRange(arrival.from, arrival.to)}</dd>
                </div>
            </dl>
        </div>
    )
}
