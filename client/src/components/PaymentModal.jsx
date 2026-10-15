import { useEffect, useRef, useState } from 'react'
import { formatRub } from '../utils/format'
import { CheckIcon } from './Icons'
import Modal from './Modal'

const PAYMENT_DELAY_MS = 1500

export default function PaymentModal({ amount, onPaid, onCancel }) {
    const [stage, setStage] = useState('form')
    const timers = useRef([])

    useEffect(() => () => timers.current.forEach(clearTimeout), [])

    const pay = () => {
        setStage('processing')
        timers.current.push(
            setTimeout(() => {
                setStage('success')
                timers.current.push(setTimeout(onPaid, 700))
            }, PAYMENT_DELAY_MS)
        )
    }

    return (
        <Modal open title="Оплата картой (имитация)" onClose={onCancel} size="sm" closable={stage === 'form'}>
            <div className="payment">
                <div className="payment__card" aria-hidden="true">
                    <span className="payment__chip" />
                    <span className="payment__number">•••• •••• •••• 4242</span>
                    <span className="payment__holder">DEMO CARD · 12/30</span>
                </div>

                <p className="payment__amount">
                    К оплате: <strong>{formatRub(amount)}</strong>
                </p>
                <p className="payment__note">
                    Это демонстрационная оплата: реальные данные карты не запрашиваются, деньги не списываются.
                </p>

                {stage === 'form' && (
                    <div className="confirm__actions">
                        <button type="button" className="btn btn--ghost" onClick={onCancel}>
                            Отмена
                        </button>
                        <button type="button" className="btn btn--primary" onClick={pay} data-autofocus>
                            Оплатить {formatRub(amount)}
                        </button>
                    </div>
                )}

                {stage === 'processing' && (
                    <p className="payment__status" role="status">
                        <span className="loader__spinner" aria-hidden="true" /> Связываемся с банком…
                    </p>
                )}

                {stage === 'success' && (
                    <p className="payment__status payment__status--success" role="status">
                        <CheckIcon /> Оплата прошла успешно. Оформляем заказ…
                    </p>
                )}
            </div>
        </Modal>
    )
}
