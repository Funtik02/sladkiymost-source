import TextField from './TextField'

export default function PickupSelect({ id, value, onChange, onBlur, error, points, city }) {
    const selected = points.find((p) => p.id === value)

    return (
        <TextField
            id={id}
            as="select"
            label={`Пункт выдачи в городе ${city}`}
            required
            value={value}
            error={error}
            hint={selected ? `${selected.address} · ${selected.hours}` : undefined}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
        >
            <option value="">— выберите пункт —</option>
            {points.map((p) => (
                <option key={p.id} value={p.id}>
                    {p.name}, {p.address}
                </option>
            ))}
        </TextField>
    )
}
