import { ThermometerIcon } from './Icons'

export default function ThermoBadge() {
    return (
        <span className="thermo-badge" tabIndex={0} role="img" aria-label="Чувствителен к температуре">
            <ThermometerIcon size={15} />
            <span className="thermo-badge__tip" aria-hidden="true">
                чувствителен к температуре
            </span>
        </span>
    )
}
