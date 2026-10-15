import { useState } from 'react'
import { createWave, getAdminWaves, updateWave } from '../../api/admin'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import TextField from '../../components/TextField'
import WaveLoadBar from '../../components/WaveLoadBar'
import { useAdmin } from '../../context/AdminContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useFetch } from '../../hooks/useFetch'
import { addDaysISO } from '../../utils/delivery'
import { formatDate, formatKg, todayISO } from '../../utils/format'
import { DIRECTION_CODES, DIRECTIONS, WAVE_STATUS_LABELS } from '../../utils/regions'

const CUTOFF_DAYS = 3

const ACTIONS = {
    close: {
        label: 'Закрыть приём',
        title: 'Закрыть приём заказов?',
        text: 'Новые заказы в эту волну приниматься не будут, принятые заказы перейдут в статус «в сборке».',
        done: 'Приём заказов закрыт',
    },
    depart: {
        label: 'Отправить',
        title: 'Отправить волну?',
        text: 'Все заказы волны перейдут в статус «в пути».',
        done: 'Волна отправлена',
    },
    postpone: {
        label: 'Перенести',
        title: 'Перенести волну на 14 дней?',
        text: 'Волна не набрала 50 кг. Её заказы переедут на следующую дату (или присоединятся к волне на эту дату), покупатели увидят перенос в статусе заказа.',
        done: 'Волна перенесена',
    },
}

function availableActions(wave) {
    const enough = wave.currentWeightKg >= wave.minWeightKg
    if (wave.status === 'open') return enough ? ['close'] : ['postpone']
    if (wave.status === 'closed' && enough) return ['depart']
    return []
}

function CreateWaveForm({ onCreated }) {
    const { call } = useAdmin()
    const [direction, setDirection] = useState('YKT_DNR')
    const [date, setDate] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const minDate = addDaysISO(todayISO(), CUTOFF_DAYS)

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!date) {
            setError('Выберите дату отправки')
            return
        }
        if (date < minDate) {
            setError(`Не раньше ${formatDate(minDate)}: приём закрывается за ${CUTOFF_DAYS} дня до отправки`)
            return
        }

        setSaving(true)
        setError('')
        try {
            const wave = await call(createWave, { direction, departureDate: date })
            onCreated(wave)
            setDate('')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="card wave-create" onSubmit={handleSubmit} noValidate>
            <h2 className="section-subtitle">Новая волна</h2>
            <div className="wave-create__fields">
                <TextField id="wave-direction" as="select" label="Направление" value={direction} onChange={(e) => setDirection(e.target.value)}>
                    {DIRECTION_CODES.map((code) => (
                        <option key={code} value={code}>
                            {DIRECTIONS[code].label}
                        </option>
                    ))}
                </TextField>
                <TextField
                    id="wave-date"
                    type="date"
                    label="Дата отправки"
                    min={minDate}
                    value={date}
                    error={error}
                    onChange={(e) => {
                        setDate(e.target.value)
                        setError('')
                    }}
                    hint={date ? `Приём заказов до ${formatDate(addDaysISO(date, -CUTOFF_DAYS))} (подставлено автоматически)` : `Дедлайн приёма — за ${CUTOFF_DAYS} дня до отправки`}
                />
                <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Создаём…' : 'Создать волну'}
                </button>
            </div>
        </form>
    )
}

function AdminWaveCard({ wave, onAction }) {
    return (
        <li className={`admin-wave admin-wave--${wave.status}`}>
            <div className="admin-wave__head">
                <strong>{formatDate(wave.departureDate, { withWeekday: true })}</strong>
                <span className={`status-pill status-pill--wave-${wave.status}`}>{WAVE_STATUS_LABELS[wave.status]}</span>
            </div>
            <p className="admin-wave__meta">
                {wave.id} · приём до {formatDate(wave.cutoffDate)} · заказов: {wave.orderCount}
            </p>
            {wave.status !== 'merged' && (
                <>
                    <WaveLoadBar currentKg={wave.currentWeightKg} maxKg={wave.maxWeightKg} label={`Загрузка волны ${wave.id}`} />
                    <p className="admin-wave__meta">
                        {formatKg(wave.currentWeightKg)} из {wave.maxWeightKg} кг
                        {wave.currentWeightKg < wave.minWeightKg && <span className="text-danger"> · меньше минимума {wave.minWeightKg} кг</span>}
                    </p>
                </>
            )}
            {wave.postponedFrom.length > 0 && (
                <p className="admin-wave__meta">Перенесена с: {wave.postponedFrom.map((d) => formatDate(d)).join(', ')}</p>
            )}
            {wave.mergedInto && <p className="admin-wave__meta">Заказы переданы в волну {wave.mergedInto}</p>}

            {availableActions(wave).length > 0 && (
                <div className="admin-wave__actions">
                    {availableActions(wave).map((action) => (
                        <button
                            key={action}
                            type="button"
                            className={`btn btn--small ${action === 'postpone' ? 'btn--danger-ghost' : 'btn--primary'}`}
                            onClick={() => onAction(wave, action)}
                        >
                            {ACTIONS[action].label}
                        </button>
                    ))}
                </div>
            )}
        </li>
    )
}

export default function AdminWaves() {
    useDocumentTitle('Админка: волны')
    const { call } = useAdmin()
    const { showToast } = useToast()
    const { data, error, loading, reload } = useFetch((signal) => call(getAdminWaves, signal), [])
    const [pending, setPending] = useState(null)
    const [busy, setBusy] = useState(false)

    if (loading && !data) return <Loader label="Загружаем волны…" />
    if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

    const runAction = async () => {
        setBusy(true)
        try {
            await call(updateWave, pending.wave.id, pending.action)
            showToast(ACTIONS[pending.action].done)
            setPending(null)
            reload()
        } catch (err) {
            showToast(err.message, { type: 'error' })
        } finally {
            setBusy(false)
        }
    }

    return (
        <section aria-label="Волны">
            <CreateWaveForm
                onCreated={(wave) => {
                    showToast(`Волна ${DIRECTIONS[wave.direction].label} на ${formatDate(wave.departureDate)} создана`)
                    reload()
                }}
            />

            <div className="dashboard">
                {DIRECTION_CODES.map((code) => {
                    const waves = data.filter((w) => w.direction === code)
                    const active = waves.filter((w) => ['open', 'closed'].includes(w.status))
                    const archive = waves.filter((w) => !['open', 'closed'].includes(w.status)).reverse()

                    return (
                        <div key={code} className="dashboard__column">
                            <h2 className="dashboard__title">{DIRECTIONS[code].label}</h2>
                            <ul className="admin-wave-list">
                                {active.map((wave) => (
                                    <AdminWaveCard key={wave.id} wave={wave} onAction={(w, action) => setPending({ wave: w, action })} />
                                ))}
                            </ul>
                            {archive.length > 0 && (
                                <details className="admin-archive">
                                    <summary>Отправленные и перенесённые ({archive.length})</summary>
                                    <ul className="admin-wave-list">
                                        {archive.map((wave) => (
                                            <AdminWaveCard key={wave.id} wave={wave} onAction={() => {}} />
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )
                })}
            </div>

            <ConfirmDialog
                open={Boolean(pending)}
                title={pending ? ACTIONS[pending.action].title : ''}
                message={pending ? `${DIRECTIONS[pending.wave.direction].label}, ${formatDate(pending.wave.departureDate)}. ${ACTIONS[pending.action].text}` : ''}
                confirmLabel={pending ? ACTIONS[pending.action].label : ''}
                danger={pending?.action === 'postpone'}
                busy={busy}
                onConfirm={runAction}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
