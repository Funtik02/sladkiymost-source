import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { formatRub, formatWeight } from '../utils/format'
import { REGIONS } from '../utils/regions'
import { TrashIcon } from './Icons'
import ProductPhoto from './ProductPhoto'
import QuantityInput from './QuantityInput'
import RegionBadge from './RegionBadge'
import ThermoBadge from './ThermoBadge'
import { GiftIcon } from './Icons'

export default function CartItem({ item, expiring = false }) {
    const { setQty, increment, decrement, remove } = useCart()
    const isBox = item.type === 'giftBox'

    return (
        <li className={`cart-item ${expiring ? 'cart-item--warning' : ''}`}>
            <div className="cart-item__media">
                {isBox ? (
                    <div className="cart-item__box" aria-hidden="true">
                        <GiftIcon size={30} strokeWidth="1.6" />
                    </div>
                ) : (
                    <Link to={`/product/${item.productId}`} tabIndex={-1} aria-hidden="true">
                        <ProductPhoto product={item} className="cart-item__photo" />
                    </Link>
                )}
            </div>

            <div className="cart-item__info">
                <div className="cart-item__badges">
                    {isBox ? (
                        <span className="tag tag--red">Набор → {REGIONS[item.destination].city}</span>
                    ) : (
                        <RegionBadge region={item.region} small />
                    )}
                    {item.temp_sensitive && <ThermoBadge />}
                </div>

                <h3 className="cart-item__title">
                    {isBox ? item.name : <Link to={`/product/${item.productId}`}>{item.name}</Link>}
                </h3>

                {isBox && (
                    <ul className="cart-item__contents">
                        {item.contents.map((c) => (
                            <li key={c.productId}>
                                <RegionBadge region={c.region} small /> {c.name}
                            </li>
                        ))}
                    </ul>
                )}

                <p className="cart-item__meta">
                    {formatWeight(item.weight_g)} · {formatRub(item.price_rub)} за шт.
                </p>

                {expiring && (
                    <p className="cart-item__alert">
                        Срок годности {item.shelf_life_days} дн. — не доедет выбранной волной
                    </p>
                )}
            </div>

            <div className="cart-item__controls">
                <QuantityInput
                    value={item.qty}
                    onChange={(qty) => setQty(item.key, qty)}
                    onIncrement={() => increment(item.key)}
                    onDecrement={() => decrement(item.key)}
                    label={`Количество: ${item.name}`}
                    small
                />
                <span className="cart-item__total">{formatRub(item.price_rub * item.qty)}</span>
                <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => remove(item.key)}
                    data-sound="remove"
                    aria-label={`Удалить «${item.name}» из корзины`}
                >
                    <TrashIcon size={20} />
                </button>
            </div>
        </li>
    )
}
