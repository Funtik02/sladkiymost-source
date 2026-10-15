import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getWavesLoad } from '../api/waves'
import Countdown from '../components/Countdown'
import ErrorMessage from '../components/ErrorMessage'
import { RefreshIcon } from '../components/Icons'
import Loader from '../components/Loader'
import WaveLoadBar from '../components/WaveLoadBar'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { getDiscount, getExpectedArrival, getNextDiscountTier, getTariffPerKg, MIN_WAVE_KG, TARIFF_PER_KG } from '../utils/delivery'
import { formatDate, formatDateRange, formatKg, formatPercent } from '../utils/format'
import { DIRECTION_CODES, DIRECTIONS, REGIONS } from '../utils/regions'
import { getWaveSeason } from '../utils/season'

const AUTO_REFRESH_MS = 60_000

function WaveCard({ wave }) {
    const fill = wave.currentWeightKg / wave.maxWeightKg
    const discount = getDiscount(fill)
    const nextTier = getNextDiscountTier(wave.currentWeightKg, wave.maxWeightKg)
    const season = getWaveSeason(wave)
    const arrival = getExpectedArrival(wave)
    const belowMin = wave.currentWeightKg < MIN_WAVE_KG

    return (
        <article className="wave-card">
            <header className="wave-card__head">
                <h3 className="wave-card__date">{formatDate(wave.departureDate, { withWeekday: true })}</h3>
                {season.key !== 'calm' && (
                    <span className={`tag ${season.key === 'offseason' ? 'tag--gold' : 'tag--blue'}`}>
                        {season.label}
                        {season.thermoRequired ? ': термоупаковка' : ': +7 дней'}
                    </span>
                )}
            </header>

            <WaveLoadBar currentKg={wave.currentWeightKg} maxKg={wave.maxWeightKg} showScale label={`Загрузка волны от ${formatDate(wave.departureDate)}`} />

            <dl className="wave-card__facts">
                <div>
                    <dt>Загружено</dt>
                    <dd>
                        {formatKg(wave.currentWeightKg)} · {formatPercent(fill)}
                    </dd>
                </div>
                <div>
                    <dt>Тариф сейчас</dt>
                    <dd>
                        {getTariffPerKg(fill)} ₽/кг
                        {discount > 0 ? <span className="tag tag--red">−{discount * 100} %</span> : <span className="muted"> · без скидки</span>}
                    </dd>
                </div>
                <div>
                    <dt>Приём до</dt>
                    <dd>{formatDate(wave.cutoffDate)}</dd>
                </div>
                <div>
                    <dt>До закрытия</dt>
                    <dd>
                        <Countdown cutoffDate={wave.cutoffDate} />
                    </dd>
                </div>
                <div>
                    <dt>Прибытие</dt>
                    <dd>{formatDateRange(arrival.from, arrival.to)}</dd>
                </div>
            </dl>

            <p className={`wave-card__hint ${belowMin ? 'wave-card__hint--warn' : ''}`}>
                {belowMin
                    ? `До минимальной загрузки не хватает ${formatKg(MIN_WAVE_KG - wave.currentWeightKg)} — иначе волна перенесётся на 14 дней.`
                    : nextTier
                      ? `Ещё ${formatKg(nextTier.neededKg)} — и тариф упадёт до ${Math.round(TARIFF_PER_KG * (1 - nextTier.discount))} ₽/кг.`
                      : 'Максимальная скидка 35 % уже действует.'}
            </p>
        </article>
    )
}

export default function LoadDashboard() {
    useDocumentTitle('Загрузка волн')
    const { data, error, loading, reload } = useFetch((signal) => getWavesLoad(signal), [])

    useEffect(() => {
        const timer = setInterval(reload, AUTO_REFRESH_MS)
        return () => clearInterval(timer)
    }, [reload])

    return (
        <div className="container section">
            <div className="section-head">
                <div>
                    <h1 className="page-title">Встречная загрузка волн</h1>
                    <p className="page-lead">
                        Волны идут навстречу друг другу раз в 14 дней. Чем больше заказов в волне, тем дешевле доставка для
                        всех её покупателей.
                    </p>
                </div>
                <button type="button" className="btn btn--ghost btn--small" onClick={reload} disabled={loading}>
                    <RefreshIcon size={18} /> {loading ? 'Обновляем…' : 'Обновить'}
                </button>
            </div>

            <ul className="legend" aria-label="Отметки на шкале">
                <li>
                    <b>50 кг</b> — минимальная партия: меньше — волна переносится
                </li>
                <li>
                    <b>150 кг</b> — заполнено больше 50 %: доставка −20 %
                </li>
                <li>
                    <b>240 кг</b> — заполнено больше 80 %: доставка −35 %
                </li>
                <li>
                    <b>300 кг</b> — максимум партии
                </li>
            </ul>

            {loading && !data && <Loader label="Загружаем волны…" />}
            {error && !data && <ErrorMessage error={error} onRetry={reload} />}

            {data && (
                <div className="dashboard">
                    {DIRECTION_CODES.map((code) => {
                        const direction = DIRECTIONS[code]
                        const region = REGIONS[direction.fromRegion]

                        return (
                            <section key={code} className={`dashboard__column theme-${region.theme}`} aria-labelledby={`col-${code}`}>
                                <div className="dashboard__head">
                                    <h2 id={`col-${code}`} className="dashboard__title">
                                        {direction.label}
                                    </h2>
                                    <Link to={`/catalog/${region.slug}`} className="link">
                                        {region.title} →
                                    </Link>
                                </div>
                                {data[code].length === 0 ? (
                                    <p className="muted">Открытых волн нет.</p>
                                ) : (
                                    data[code].map((wave) => <WaveCard key={wave.id} wave={wave} />)
                                )}
                            </section>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
