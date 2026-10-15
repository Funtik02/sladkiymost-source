import { useState } from 'react'

const MIN = 1
const MAX = 99

export default function QuantityInput({
    value,
    onChange,
    onIncrement = () => onChange(Math.min(MAX, value + 1)),
    onDecrement = () => onChange(Math.max(MIN, value - 1)),
    label = 'Количество',
    disabled = false,
    small = false,
}) {
    const [draft, setDraft] = useState(null)

    const commit = (raw) => {
        const number = Math.round(Number(raw))
        const next = Number.isFinite(number) && number >= MIN ? Math.min(MAX, number) : MIN
        setDraft(null)
        if (next !== value) onChange(next)
    }

    return (
        <div className={`qty ${small ? 'qty--small' : ''}`} role="group" aria-label={label}>
            <button
                type="button"
                className="qty__btn"
                onClick={onDecrement}
                disabled={disabled || value <= MIN}
                aria-label="Уменьшить количество"
            >
                −
            </button>
            <input
                className="qty__input"
                type="number"
                inputMode="numeric"
                min={MIN}
                max={MAX}
                value={draft ?? String(value)}
                disabled={disabled}
                aria-label={label}
                onChange={(event) => {
                    setDraft(event.target.value)
                    const number = Number(event.target.value)
                    if (Number.isInteger(number) && number >= MIN && number <= MAX) onChange(number)
                }}
                onBlur={(event) => commit(event.target.value)}
            />
            <button
                type="button"
                className="qty__btn"
                onClick={onIncrement}
                disabled={disabled || value >= MAX}
                aria-label="Увеличить количество"
            >
                +
            </button>
        </div>
    )
}
