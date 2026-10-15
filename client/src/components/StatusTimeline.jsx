import { formatDateTime } from '../utils/format'
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '../utils/regions'
import { CheckIcon } from './Icons'

export default function StatusTimeline({ status, history }) {
    const currentIndex = ORDER_STATUSES.indexOf(status)
    const finished = currentIndex === ORDER_STATUSES.length - 1

    const reachedAt = (step) => [...history].reverse().find((h) => h.status === step)?.at

    return (
        <ol className="timeline">
            {ORDER_STATUSES.map((step, index) => {
                const state = index < currentIndex || finished ? 'done' : index === currentIndex ? 'current' : 'todo'
                const date = index <= currentIndex ? reachedAt(step) : null

                return (
                    <li key={step} className={`timeline__step timeline__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="timeline__dot" aria-hidden="true">
                            {state === 'todo' ? index + 1 : <CheckIcon size={16} />}
                        </span>
                        <span className="timeline__label">{ORDER_STATUS_LABELS[step]}</span>
                        <span className="timeline__date">{date ? formatDateTime(date) : state === 'todo' ? 'ожидается' : ''}</span>
                    </li>
                )
            })}
        </ol>
    )
}
