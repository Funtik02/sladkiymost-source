import { calcDelivery, getExpectedArrival, getWaveBlocker } from '../utils/delivery'
import { formatDate, formatDateRange, formatKg, formatPercent } from '../utils/format'
import { getWaveSeason } from '../utils/season'
import WaveLoadBar from './WaveLoadBar'

export default function WavePicker({ waves, items, selectedId, onSelect }) {
    return (
        <fieldset className="wave-picker">
            <legend className="wave-picker__legend">Волна отправки</legend>
            <ul className="wave-picker__list">
                {waves.map((wave) => {
                    const calc = calcDelivery({ items, wave })
                    const blocker = getWaveBlocker(items, wave)
                    const season = getWaveSeason(wave)
                    const arrival = getExpectedArrival(wave)
                    const inputId = `wave-${wave.id}`

                    return (
                        <li key={wave.id}>
                            <label
                                htmlFor={inputId}
                                className={`wave-option ${selectedId === wave.id ? 'wave-option--selected' : ''} ${blocker ? 'wave-option--disabled' : ''}`}
                            >
                                <input
                                    id={inputId}
                                    type="radio"
                                    name="wave"
                                    value={wave.id}
                                    checked={selectedId === wave.id}
                                    disabled={Boolean(blocker)}
                                    onChange={() => onSelect(wave.id)}
                                />
                                <span className="wave-option__body">
                                    <span className="wave-option__head">
                                        <strong>Отправка {formatDate(wave.departureDate, { withWeekday: true })}</strong>
                                        {calc.discount > 0 && !blocker && (
                                            <span className="tag tag--red">−{calc.discount * 100} % на доставку</span>
                                        )}
                                        {season.key === 'offseason' && <span className="tag tag--gold">межсезонье +7 дней</span>}
                                        {season.thermoRequired && <span className="tag tag--blue">{season.label.toLowerCase()}: термоупаковка</span>}
                                    </span>
                                    <span className="wave-option__meta">
                                        Приём до {formatDate(wave.cutoffDate)} · прибытие {formatDateRange(arrival.from, arrival.to)}
                                    </span>
                                    <WaveLoadBar
                                        currentKg={wave.currentWeightKg}
                                        addedKg={calc.weightKg}
                                        maxKg={wave.maxWeightKg}
                                        label={`Загрузка волны от ${formatDate(wave.departureDate)}`}
                                    />
                                    <span className="wave-option__meta">
                                        В волне {formatKg(wave.currentWeightKg)} + ваш заказ {formatKg(calc.weightKg)} = заполнение{' '}
                                        {formatPercent(Math.min(1, calc.fillRatio))}
                                    </span>
                                    {blocker && <span className="wave-option__blocker">{blocker}</span>}
                                </span>
                            </label>
                        </li>
                    )
                })}
            </ul>
        </fieldset>
    )
}
