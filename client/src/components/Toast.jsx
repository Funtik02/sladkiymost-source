import { Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { CloseIcon } from './Icons'

export default function Toast() {
    const { toasts, dismissToast } = useToast()

    return (
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
                    <span className="toast__message">{toast.message}</span>
                    {toast.action && (
                        <Link className="toast__action" to={toast.action.to} onClick={() => dismissToast(toast.id)}>
                            {toast.action.label}
                        </Link>
                    )}
                    <button
                        type="button"
                        className="toast__close"
                        onClick={() => dismissToast(toast.id)}
                        aria-label="Закрыть уведомление"
                    >
                        <CloseIcon size={16} />
                    </button>
                </div>
            ))}
        </div>
    )
}
