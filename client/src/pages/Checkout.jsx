import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { createOrder, quoteOrder } from '../api/orders'
import { getPickupPoints, getWaves } from '../api/waves'
import DeliveryBreakdown from '../components/DeliveryBreakdown'
import CompanyFields from '../components/CompanyFields'
import ConsentCheckbox from '../components/ConsentCheckbox'
import ErrorMessage from '../components/ErrorMessage'
import GiftFields from '../components/GiftFields'
import Loader from '../components/Loader'
import PaymentModal from '../components/PaymentModal'
import PickupSelect from '../components/PickupSelect'
import TextField from '../components/TextField'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { toOrderItems } from '../utils/cart'
import { calcDelivery, getExpectedArrival, getWaveBlocker } from '../utils/delivery'
import { formatDate, formatDateRange, formatRub } from '../utils/format'
import { PAYMENT_OPTIONS } from '../utils/company'
import { DIRECTIONS } from '../utils/regions'
import { playSound } from '../utils/sound'
import { readJSON, removeKey, writeJSON } from '../utils/storage'
import { formatPhone, normalizePhone, validateCheckout } from '../utils/validation'

const DRAFT_KEY = 'sweet-bridge:checkout-draft'

const EMPTY_FORM = {
    buyerType: 'person',
    scenario: 'self',
    customer: { name: '', phone: '', email: '' },
    recipient: { name: '', phone: '' },
    company: { name: '', inn: '', kpp: '', address: '' },
    pickupPointId: '',
    gift: { cardText: '', cardDesign: 'north', hidePrice: false },
    paymentMethod: 'card',
}

const BUYER_TYPES = [
    { value: 'person', label: 'Физическое лицо' },
    { value: 'company', label: 'Юридическое лицо' },
]

const SCENARIOS = [
    { value: 'self', label: 'Заказ себе' },
    { value: 'gift', label: 'Подарок в другой регион' },
]

function loadDraft() {
    const draft = readJSON(sessionStorage, DRAFT_KEY, null)
    if (!draft || typeof draft !== 'object') return EMPTY_FORM

    const str = (v) => (typeof v === 'string' ? v : '')
    const buyerType = draft.buyerType === 'company' ? 'company' : 'person'
    return {
        buyerType,
        company: {
            name: str(draft.company?.name),
            inn: str(draft.company?.inn),
            kpp: str(draft.company?.kpp),
            address: str(draft.company?.address),
        },
        scenario: draft.scenario === 'gift' ? 'gift' : 'self',
        customer: { name: str(draft.customer?.name), phone: str(draft.customer?.phone), email: str(draft.customer?.email) },
        recipient: { name: str(draft.recipient?.name), phone: str(draft.recipient?.phone) },
        pickupPointId: str(draft.pickupPointId),
        gift: {
            cardText: str(draft.gift?.cardText).slice(0, 300),
            cardDesign: ['north', 'south', 'bridge'].includes(draft.gift?.cardDesign) ? draft.gift.cardDesign : 'north',
            hidePrice: draft.gift?.hidePrice === true,
        },
        paymentMethod: PAYMENT_OPTIONS[buyerType].some((o) => o.value === draft.paymentMethod)
            ? draft.paymentMethod
            : PAYMENT_OPTIONS[buyerType][0].value,
    }
}

function fieldId(section, key) {
    if (key === 'pickupPointId') return `${section}-pickup`
    if (key === 'paymentMethod') return 'payment-method'
    if (key === 'consent') return 'personal-data-consent'
    return `${section}-${key.replace('.', '-')}`
}

function Segmented({ label, options, value, name, onChange }) {
    return (
        <div className="segmented" role="radiogroup" aria-label={label}>
            {options.map((option) => (
                <label
                    key={option.value}
                    className={`segmented__option ${value === option.value ? 'segmented__option--active' : ''}`}
                >
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => onChange(option.value)}
                    />
                    {option.label}
                </label>
            ))}
        </div>
    )
}

export default function Checkout() {
    useDocumentTitle('Оформление заказа')
    const { items, waveId, syncing } = useCart()
    const { isLoggedIn, checking } = useAuth()
    const [placed, setPlaced] = useState(false)

    if (checking || syncing) return <Loader label="Загружаем корзину…" />

    if (!isLoggedIn && !placed) {
        return <Navigate to="/account?reason=checkout&next=/checkout" replace />
    }

    if (!placed && (items.length === 0 || !waveId)) {
        return <Navigate to="/cart" replace />
    }

    return <CheckoutView placed={placed} onPlaced={() => setPlaced(true)} />
}

function CheckoutView({ placed, onPlaced }) {
    const cart = useCart()
    const { items, direction, waveId, thermoChosen, consent, setConsent, goodsTotal, clear } = cart
    const navigate = useNavigate()
    const info = DIRECTIONS[direction]

    const [form, setForm] = useState(loadDraft)
    const [touched, setTouched] = useState({})
    const [submitAttempted, setSubmitAttempted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [serverError, setServerError] = useState(null)
    const [payment, setPayment] = useState(null)

    const data = useFetch(
        (signal) => Promise.all([getWaves(direction, signal), getPickupPoints(direction, signal)]),
        [direction]
    )

    useEffect(() => {
        writeJSON(sessionStorage, DRAFT_KEY, form)
    }, [form])

    const { user, token } = useAuth()
    const [prefilledFor, setPrefilledFor] = useState(null)

    if (user && prefilledFor !== user.id) {
        setPrefilledFor(user.id)
        setForm((prev) => ({
            ...prev,
            customer: {
                name: prev.customer.name || user.name,
                phone: prev.customer.phone || (user.phone ? formatPhone(user.phone) : ''),
                email: prev.customer.email || user.email,
            },
        }))
    }

    if (placed) return <Loader label="Открываем ваш заказ…" />

    if (data.loading && !data.data) {
        return (
            <div className="container section">
                <Loader label="Готовим оформление…" />
            </div>
        )
    }

    if (data.error && !data.data) {
        return (
            <div className="container section">
                <ErrorMessage error={data.error} onRetry={data.reload} />
            </div>
        )
    }

    const [waves, pickupPoints] = data.data
    const wave = waves.find((w) => w.id === waveId)
    const blocker = wave ? getWaveBlocker(items, wave) : null

    if (!wave || blocker) {
        return (
            <div className="container section">
                <h1 className="page-title">Оформление заказа</h1>
                <div className="notice notice--warning" role="alert">
                    <p className="notice__title">Нужно выбрать другую волну</p>
                    <p>{blocker ?? 'Выбранная волна больше не принимает заказы.'}</p>
                </div>
                <Link to="/cart" className="btn btn--primary">
                    Вернуться в корзину
                </Link>
            </div>
        )
    }

    const calc = calcDelivery({ items, wave, thermoChosen })
    const total = goodsTotal + calc.total
    const arrival = getExpectedArrival(wave)
    const city = info.toCity

    const allErrors = {
        ...validateCheckout(form),
        ...(consent ? {} : { consent: 'Без согласия на обработку персональных данных заказ не оформить' }),
    }
    const errors = Object.fromEntries(Object.entries(allErrors).filter(([key]) => submitAttempted || touched[key]))

    const setField = (path, value) => {
        setForm((prev) => {
            if (!path.includes('.')) return { ...prev, [path]: value }
            const [group, key] = path.split('.')
            return { ...prev, [group]: { ...prev[group], [key]: value } }
        })
    }

    const touch = (path) => {
        setTouched((prev) => ({ ...prev, [path]: true }))
        if (path.endsWith('phone')) {
            const [group, key] = path.split('.')
            setField(path, formatPhone(form[group][key]))
        }
    }

    const isCompany = form.buyerType === 'company'
    const section = isCompany ? 'company' : form.scenario
    const paymentOptions = PAYMENT_OPTIONS[form.buyerType]

    const setBuyerType = (buyerType) => {
        if (buyerType === form.buyerType) return
        setForm((prev) => ({ ...prev, buyerType, paymentMethod: PAYMENT_OPTIONS[buyerType][0].value }))
    }

    const buildPayload = () => ({
        buyerType: form.buyerType,
        scenario: isCompany ? 'self' : form.scenario,
        company: isCompany
            ? {
                  name: form.company.name.trim(),
                  inn: form.company.inn.trim(),
                  kpp: form.company.kpp.trim().toUpperCase(),
                  address: form.company.address.trim(),
              }
            : undefined,
        items: toOrderItems(items),
        waveId,
        thermoChosen,
        customer: {
            name: form.customer.name.trim(),
            phone: normalizePhone(form.customer.phone),
            email: form.customer.email.trim(),
        },
        recipient:
            !isCompany && form.scenario === 'gift'
                ? { name: form.recipient.name.trim(), phone: normalizePhone(form.recipient.phone) }
                : undefined,
        pickupPointId: form.pickupPointId,
        gift: !isCompany && form.scenario === 'gift' ? { ...form.gift, cardText: form.gift.cardText.trim() } : undefined,
        paymentMethod: form.paymentMethod,
        personalDataConsent: consent,
        clientTotal: total,
    })

    const placeOrder = async (payload) => {
        const order = await createOrder(payload, token)
        playSound('success')
        onPlaced()
        removeKey(sessionStorage, DRAFT_KEY)
        navigate(`/order/${order.orderId}/success`, { state: { order } })
        clear()
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSubmitAttempted(true)
        setServerError(null)

        const firstError = Object.keys(allErrors)[0]
        if (firstError) {
            document.getElementById(fieldId(section, firstError))?.focus()
            return
        }

        const payload = buildPayload()
        setSubmitting(true)

        try {
            if (form.paymentMethod === 'card') {
                const quote = await quoteOrder(payload)
                setPayment({ amount: quote.total, payload })
                return
            }

            await placeOrder(payload)
        } catch (error) {
            setServerError(error.message)
            setSubmitting(false)
        }
    }

    const handlePaid = async () => {
        try {
            await placeOrder(payment.payload)
        } catch (error) {
            setPayment(null)
            setServerError(`${error.message}. Деньги не списаны: оплата на сайте — имитация.`)
            setSubmitting(false)
        }
    }

    const field = (path, props) => ({
        id: fieldId('self', path),
        error: errors[path],
        onBlur: () => touch(path),
        onChange: (event) => setField(path, event.target.value),
        ...props,
    })

    return (
        <div className="container section">
            <nav className="breadcrumbs" aria-label="Хлебные крошки">
                <Link to="/cart">Корзина</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Оформление</span>
            </nav>
            <h1 className="page-title">Оформление заказа</h1>

            <form className="checkout" onSubmit={handleSubmit} noValidate>
                <div className="checkout__main">
                    <p className="account-note">
                        Заказ сохранится в вашем <Link to="/account" className="link">личном кабинете</Link>.
                    </p>
                    <div className="buyer-switch">
                        <Segmented
                            label="Покупатель"
                            name="buyerType"
                            options={BUYER_TYPES}
                            value={form.buyerType}
                            onChange={setBuyerType}
                        />
                        {!isCompany && (
                            <Segmented
                                label="Кому заказ"
                                name="scenario"
                                options={SCENARIOS}
                                value={form.scenario}
                                onChange={(value) => setField('scenario', value)}
                            />
                        )}
                    </div>

                    {isCompany ? (
                        <CompanyFields
                            form={form}
                            errors={errors}
                            onChange={setField}
                            onBlur={touch}
                            pickupPoints={pickupPoints}
                            city={city}
                        />
                    ) : form.scenario === 'self' ? (
                        <fieldset className="form-section">
                            <legend className="form-section__title">Получатель — вы, в городе {city}</legend>
                            <div className="form-grid">
                                <TextField {...field('customer.name')} label="Имя" required value={form.customer.name} autoComplete="name" />
                                <TextField
                                    {...field('customer.phone')}
                                    label="Телефон"
                                    required
                                    type="tel"
                                    value={form.customer.phone}
                                    autoComplete="tel"
                                    placeholder="+7 914 123-45-67"
                                />
                                <TextField
                                    {...field('customer.email')}
                                    label="Email"
                                    required
                                    type="email"
                                    value={form.customer.email}
                                    autoComplete="email"
                                    placeholder="name@mail.ru"
                                    hint="Пришлём номер заказа и уведомления о волне"
                                    className="form-grid__wide"
                                />
                                <div className="form-grid__wide">
                                    <PickupSelect
                                        id="self-pickup"
                                        value={form.pickupPointId}
                                        onChange={(value) => setField('pickupPointId', value)}
                                        onBlur={() => touch('pickupPointId')}
                                        error={errors.pickupPointId}
                                        points={pickupPoints}
                                        city={city}
                                    />
                                </div>
                            </div>
                        </fieldset>
                    ) : (
                        <GiftFields
                            form={form}
                            errors={errors}
                            onChange={setField}
                            onBlur={touch}
                            pickupPoints={pickupPoints}
                            city={city}
                        />
                    )}

                    <fieldset className="form-section">
                        <legend className="form-section__title">Оплата</legend>
                        <div className="pay-options">
                            {paymentOptions.map((option, index) => (
                                <label
                                    key={option.value}
                                    className={`pay-option ${form.paymentMethod === option.value ? 'pay-option--active' : ''}`}
                                >
                                    <input
                                        id={index === 0 ? 'payment-method' : undefined}
                                        type="radio"
                                        name="paymentMethod"
                                        value={option.value}
                                        checked={form.paymentMethod === option.value}
                                        onChange={() => setField('paymentMethod', option.value)}
                                    />
                                    <span>
                                        <strong>{option.title}</strong>
                                        <span className="pay-option__text">{option.text}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <ConsentCheckbox
                        checked={consent}
                        onChange={(value) => {
                            setConsent(value)
                            touch('consent')
                        }}
                        error={errors.consent}
                    />

                    {serverError && (
                        <div className="notice notice--danger" role="alert">
                            <p className="notice__title">Заказ не оформлен</p>
                            <p>{serverError}</p>
                            <p>
                                Данные формы сохранены. <Link to="/cart" className="link">Проверить корзину</Link>
                            </p>
                        </div>
                    )}

                    {submitAttempted && Object.keys(allErrors).length > 0 && (
                        <p className="field__error" role="alert">
                            Проверьте поля, отмеченные красным.
                        </p>
                    )}

                    <button type="submit" className="btn btn--primary btn--large btn--block" disabled={submitting}>
                        {submitting
                            ? 'Отправляем…'
                            : form.paymentMethod === 'card'
                              ? `Перейти к оплате · ${formatRub(total)}`
                              : `Оформить заказ · ${formatRub(total)}`}
                    </button>
                </div>

                <aside className="checkout__aside">
                    <div className="card summary">
                        <h2 className="section-subtitle">Ваш заказ</h2>
                        <ul className="summary__items">
                            {items.map((item) => (
                                <li key={item.key}>
                                    <span>
                                        {item.name} × {item.qty}
                                    </span>
                                    <span>{formatRub(item.price_rub * item.qty)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="summary__wave">
                            <p>
                                <strong>Волна «{info.label}»</strong>
                            </p>
                            <p>Отправка {formatDate(wave.departureDate, { withWeekday: true })}</p>
                            <p>Ожидаемое получение: {formatDateRange(arrival.from, arrival.to)}</p>
                        </div>
                        <DeliveryBreakdown calc={calc} goodsTotal={goodsTotal} />
                        <Link to="/cart" className="link">
                            Изменить состав или волну
                        </Link>
                    </div>
                </aside>
            </form>

            {payment && (
                <PaymentModal
                    amount={payment.amount}
                    onPaid={handlePaid}
                    onCancel={() => {
                        setPayment(null)
                        setSubmitting(false)
                    }}
                />
            )}
        </div>
    )
}
