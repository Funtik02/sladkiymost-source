import { useNow } from '../hooks/useNow'
import { parseISODate, pluralize } from '../utils/format'

const pad = (n) => String(n).padStart(2, '0')

export default function Countdown({ cutoffDate }) {
    const now = useNow(1000)
    const end = parseISODate(cutoffDate)
    end.setHours(23, 59, 59, 999)

    const left = end.getTime() - now
    if (left <= 0) return <span className="countdown countdown--over">приём закрыт</span>

    const totalSeconds = Math.floor(left / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return (
        <span className={`countdown ${days < 2 ? 'countdown--soon' : ''}`}>
            {days > 0 && `${days} ${pluralize(days, ['день', 'дня', 'дней'])} `}
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
    )
}
