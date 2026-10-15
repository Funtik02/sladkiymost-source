import { DISCOUNT_TIERS, MAX_WAVE_KG, MIN_WAVE_KG } from '../utils/delivery'
import { formatKg } from '../utils/format'

const MARKERS = [
    { kg: MIN_WAVE_KG, note: 'мин.' },
    ...[...DISCOUNT_TIERS].reverse().map((t) => ({ kg: t.fill * MAX_WAVE_KG, note: `−${t.discount * 100} %` })),
]

const pct = (kg, maxKg) => `${Math.min(100, (kg / maxKg) * 100)}%`

export default function WaveLoadBar({ currentKg, addedKg = 0, maxKg = MAX_WAVE_KG, showScale = false, label }) {
    const total = currentKg + addedKg
    const overflow = total > maxKg
    const ariaText = addedKg > 0
        ? `${formatKg(currentKg)} уже в волне и ${formatKg(addedKg)} ваш заказ, всего ${formatKg(total)} из ${maxKg} кг`
        : `${formatKg(currentKg)} из ${maxKg} кг`

    return (
        <div className={`load-bar ${showScale ? 'load-bar--scaled' : ''}`}>
            <div
                className="load-bar__track"
                role="meter"
                aria-label={label ?? 'Загрузка волны'}
                aria-valuemin={0}
                aria-valuemax={maxKg}
                aria-valuenow={Math.min(total, maxKg)}
                aria-valuetext={ariaText}
            >
                <div className="load-bar__fill" style={{ width: pct(currentKg, maxKg) }} />
                {addedKg > 0 && (
                    <div
                        className={`load-bar__added ${overflow ? 'load-bar__added--overflow' : ''}`}
                        style={{ left: pct(currentKg, maxKg), width: pct(Math.min(addedKg, maxKg - currentKg), maxKg) }}
                    />
                )}
                {MARKERS.map((m) => (
                    <span key={m.kg} className="load-bar__marker" style={{ left: pct(m.kg, maxKg) }} />
                ))}
            </div>

            {showScale && (
                <div className="load-bar__scale" aria-hidden="true">
                    {MARKERS.map((m) => (
                        <span key={m.kg} className="load-bar__tick" style={{ left: pct(m.kg, maxKg) }}>
                            <b>{m.kg}</b>
                            {m.note}
                        </span>
                    ))}
                    <span className="load-bar__tick load-bar__tick--end">
                        <b>{maxKg}</b>
                        кг
                    </span>
                </div>
            )}
        </div>
    )
}
