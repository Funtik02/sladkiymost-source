import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProductsByIds } from '../api/products'
import { getWaves } from '../api/waves'
import CartItem from '../components/CartItem'
import ConfirmDialog from '../components/ConfirmDialog'
import DeliveryBreakdown from '../components/DeliveryBreakdown'
import ErrorMessage from '../components/ErrorMessage'
import Loader from '../components/Loader'
import SeasonWarning from '../components/SeasonWarning'
import WavePicker from '../components/WavePicker'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import {
    THERMO_PRICE,
    calcDelivery,
    getExpiringItems,
    getNextDiscountTier,
    getWaveBlocker,
} from '../utils/delivery'
import { formatDate, formatKg, formatRub, pluralize } from '../utils/format'
import { DIRECTIONS } from '../utils/regions'
import { getWaveSeason } from '../utils/season'
import { playSound } from '../utils/sound'
import ConsentCheckbox from '../components/ConsentCheckbox'
import { TruckIcon } from '../components/Icons'

export default function Cart() {
    useDocumentTitle('Корзина')
    const { items, syncing } = useCart()
    const { token } = useAuth()

    if (syncing) {
        return (
            <div className="container section">
                <h1 className="page-title">Корзина</h1>
                <Loader label="Загружаем корзину из аккаунта…" />
            </div>
        )
    }

    if (!token) {
        return (
            <div className="container section">
                <h1 className="page-title">Корзина</h1>
                <div className="state">
                    <p className="state__title">Войдите, чтобы пользоваться корзиной</p>
                    <p className="state__text">Корзина хранится в личном кабинете — она будет ждать вас на любом устройстве.</p>
                    <div className="state__actions">
                        <Link to="/account?next=/cart" className="btn btn--primary">
                            Войти
                        </Link>
                        <Link to="/account?mode=register&next=/cart" className="btn btn--ghost">
                            Зарегистрироваться
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="container section">
                <h1 className="page-title">Корзина</h1>
                <div className="state">
                    <p className="state__title">В корзине пока пусто</p>
                    <p className="state__text">Загляните на витрины — сладости обоих регионов ждут.</p>
                    <div className="state__actions">
                        <Link to="/catalog/yakutia" className="btn btn--primary">
                            Сладости Якутии
                        </Link>
                        <Link to="/catalog/donbass" className="btn btn--primary">
                            Сладости Донбасса
                        </Link>
                        <Link to="/gift-box" className="btn btn--ghost">
                            Набор «Север + Юг»
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return <CartView />
}

function collectProductIds(items) {
    const ids = items.flatMap((i) => (i.type === 'giftBox' ? i.contents.map((c) => c.productId) : [i.productId]))
    return [...new Set(ids)].sort()
}

function useCartSync() {
    const cart = useCart()
    const { showToast } = useToast()
    const { items, syncProducts } = cart

    const ids = collectProductIds(items)
    const sync = useFetch((signal) => getProductsByIds(ids, signal), [ids.join(',')])

    useEffect(() => {
        if (!sync.data) return

        const byId = new Map(sync.data.map((p) => [p.id, p]))
        const missing = items.filter((i) =>
            i.type === 'giftBox' ? i.contents.some((c) => !byId.has(c.productId)) : !byId.has(i.productId)
        )
        const priceChanged = items.some((i) =>
            i.type === 'giftBox'
                ? i.contents.some((c) => byId.has(c.productId) && byId.get(c.productId).price_rub !== c.price_rub)
                : byId.has(i.productId) && byId.get(i.productId).price_rub !== i.price_rub
        )

        if (missing.length === 0 && !priceChanged) return

        syncProducts(sync.data)
        if (missing.length > 0) {
            showToast(`Больше не продаётся и удалено из корзины: ${missing.map((i) => `«${i.name}»`).join(', ')}`, { type: 'info' })
        }
        if (priceChanged) showToast('Цены в корзине обновлены по актуальному каталогу', { type: 'info' })
    }, [sync.data, items, syncProducts, showToast])
}

function CartView() {
    const cart = useCart()
    const { items, direction, waveId, thermoChosen, consent, goodsTotal, weightKg, count, setWave, setThermo, setConsent, clear } = cart
    const { showToast } = useToast()
    const navigate = useNavigate()
    const [confirmClear, setConfirmClear] = useState(false)
    const info = DIRECTIONS[direction]

    useCartSync()

    const waves = useFetch((signal) => getWaves(direction, signal), [direction])

    useEffect(() => {
        if (waves.data && waveId && !waves.data.some((w) => w.id === waveId)) {
            setWave(null)
            showToast('Выбранная волна больше не принимает заказы — выберите другую', { type: 'info' })
        }
    }, [waves.data, waveId, setWave, showToast])

    const selectedWave = waves.data?.find((w) => w.id === waveId) ?? null
    const calc = selectedWave ? calcDelivery({ items, wave: selectedWave, thermoChosen }) : null
    const blocker = selectedWave ? getWaveBlocker(items, selectedWave) : null
    const expiringKeys = new Set(selectedWave ? getExpiringItems(items, selectedWave).map((i) => i.key) : [])
    const season = selectedWave ? getWaveSeason(selectedWave) : null
    const nextTier = calc && !blocker ? getNextDiscountTier(calc.waveWeightAfterKg, selectedWave.maxWeightKg) : null
    const hasTempSensitive = items.some((i) => i.temp_sensitive)

    let checkoutHint = ''
    if (!selectedWave) checkoutHint = 'Выберите волну отправки, чтобы оформить заказ'
    else if (blocker) checkoutHint = `Выбранная волна не подходит: ${blocker}`
    else if (!consent) checkoutHint = 'Отметьте согласие на обработку персональных данных, чтобы оформить заказ'

    return (
        <div className="container section">
            <h1 className="page-title">Корзина</h1>
            <p className="page-lead">
                Все позиции едут одной волной «{info.label}» — в {info.toCity}.
            </p>

            <div className="cart-layout">
                <div className="cart-layout__main">
                    <ul className="cart-list">
                        {items.map((item) => (
                            <CartItem key={item.key} item={item} expiring={expiringKeys.has(item.key)} />
                        ))}
                    </ul>

                    <div className="cart-list__footer">
                        <span>
                            {count} {pluralize(count, ['штука', 'штуки', 'штук'])} · общий вес <strong>{formatKg(weightKg)}</strong>
                        </span>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmClear(true)}>
                            Очистить корзину
                        </button>
                    </div>

                    <section className="card" aria-labelledby="wave-title">
                        <h2 id="wave-title" className="section-subtitle">
                            Когда отправить
                        </h2>
                        <p className="muted">
                            Волна уходит раз в 14 дней. Чем полнее волна вместе с вашим заказом, тем дешевле доставка.
                        </p>
                        {waves.loading && !waves.data && <Loader label="Загружаем открытые волны…" />}
                        {waves.error && !waves.data && <ErrorMessage error={waves.error} onRetry={waves.reload} />}
                        {waves.data && waves.data.length === 0 && (
                            <p className="notice notice--warning">Сейчас нет открытых волн в этом направлении. Загляните позже.</p>
                        )}
                        {waves.data && waves.data.length > 0 && (
                            <WavePicker waves={waves.data} items={items} selectedId={waveId} onSelect={setWave} />
                        )}
                    </section>
                </div>

                <aside className="cart-layout__aside">
                    <div className="card summary">
                        <h2 className="section-subtitle">Ваш заказ</h2>
                        <dl className="summary__list">
                            <div>
                                <dt>Товары ({count} шт.)</dt>
                                <dd>{formatRub(goodsTotal)}</dd>
                            </div>
                            <div>
                                <dt>Общий вес</dt>
                                <dd>{formatKg(weightKg)}</dd>
                            </div>
                        </dl>

                        <div className="thermo-option">
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={calc ? calc.thermoApplied : thermoChosen}
                                    disabled={Boolean(calc?.thermoRequired)}
                                    onChange={(event) => setThermo(event.target.checked)}
                                    aria-describedby="thermo-note"
                                />
                                <span>Термоупаковка, +{THERMO_PRICE} ₽ за заказ</span>
                            </label>
                            <p id="thermo-note" className="thermo-option__note">
                                {calc?.thermoRequired
                                    ? `Обязательна: отправка ${formatDate(selectedWave.departureDate)} — ${season.label.toLowerCase()}, в заказе есть термочувствительные товары (${season.reason}).`
                                    : selectedWave
                                      ? 'В этот сезон — по желанию: сохранит форму шоколада и зефира в дороге.'
                                      : 'Зимой и летом для термочувствительных товаров она обязательна — зависит от даты волны.'}
                            </p>
                        </div>

                        {calc ? (
                            <DeliveryBreakdown calc={calc} goodsTotal={goodsTotal} />
                        ) : (
                            <p className="summary__placeholder">Выберите волну — и мы посчитаем доставку.</p>
                        )}

                        {nextTier && (
                            <p className="motivator">
                                <TruckIcon size={18} />
                                Ещё {formatKg(nextTier.neededKg)} в волне — и{' '}
                                {calc.discount > 0
                                    ? `скидка на доставку вырастет до ${nextTier.discount * 100} %`
                                    : `доставка подешевеет на ${nextTier.discount * 100} %`}
                                . Позовите друзей заказать в эту же волну!
                            </p>
                        )}

                        {selectedWave && <SeasonWarning wave={selectedWave} tempSensitive={hasTempSensitive} />}

                        <ConsentCheckbox checked={consent} onChange={setConsent} />

                        <button
                            type="button"
                            className="btn btn--primary btn--large btn--block"
                            onClick={() => navigate('/checkout')}
                            disabled={Boolean(checkoutHint)}
                            aria-describedby={checkoutHint ? 'checkout-hint' : undefined}
                        >
                            Оформить заказ
                        </button>
                        {checkoutHint && (
                            <p id="checkout-hint" className="summary__hint">
                                {checkoutHint}
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            <ConfirmDialog
                open={confirmClear}
                title="Очистить корзину?"
                message="Все позиции и выбранная волна будут удалены из корзины."
                confirmLabel="Очистить"
                danger
                onConfirm={() => {
                    playSound('remove')
                    clear()
                    setConfirmClear(false)
                    showToast('Корзина очищена', { type: 'info' })
                }}
                onCancel={() => setConfirmClear(false)}
            />
        </div>
    )
}
