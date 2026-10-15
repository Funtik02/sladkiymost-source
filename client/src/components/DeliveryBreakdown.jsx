import { DISCOUNT_TIERS, THERMO_PRICE } from '../utils/delivery'
import { formatKg, formatPercent, formatRub } from '../utils/format'

const MAX_DISCOUNT = DISCOUNT_TIERS[0].discount

export default function DeliveryBreakdown({ calc, goodsTotal, goodsLabel = 'Товары' }) {
    const fillText = formatPercent(Math.min(1, calc.fillRatio))

    return (
        <div className="breakdown">
            <dl className="breakdown__list">
                <div className="breakdown__row">
                    <dt>
                        Доставка по весу
                        <span className="breakdown__hint">
                            {formatKg(calc.weightKg)} × {calc.tariffPerKg} ₽/кг
                        </span>
                    </dt>
                    <dd>{formatRub(calc.baseCost)}</dd>
                </div>

                <div className="breakdown__row">
                    <dt>
                        Скидка за заполненность
                        <span className="breakdown__hint">
                            {calc.discount > 0
                                ? `волна заполнена на ${fillText} → −${calc.discount * 100} %`
                                : `волна заполнена на ${fillText} — скидка начнётся после 50 %`}
                        </span>
                    </dt>
                    <dd className={calc.discount > 0 ? 'breakdown__discount' : ''}>
                        {calc.discount > 0 ? `−${formatRub(calc.discountAmount)}` : formatRub(0)}
                    </dd>
                </div>

                <div className="breakdown__row">
                    <dt>
                        Термоупаковка
                        <span className="breakdown__hint">
                            {calc.thermoRequired ? 'обязательна в этот сезон' : calc.thermoApplied ? 'по вашему выбору' : 'не выбрана'}
                        </span>
                    </dt>
                    <dd>{calc.thermoApplied ? formatRub(THERMO_PRICE) : '—'}</dd>
                </div>

                <div className="breakdown__row breakdown__row--sub">
                    <dt>Доставка итого</dt>
                    <dd>{formatRub(calc.total)}</dd>
                </div>

                <div className="breakdown__row">
                    <dt>{goodsLabel}</dt>
                    <dd>{formatRub(goodsTotal)}</dd>
                </div>

                <div className="breakdown__row breakdown__row--total">
                    <dt>К оплате</dt>
                    <dd>{formatRub(goodsTotal + calc.total)}</dd>
                </div>
            </dl>

            {calc.discount < MAX_DISCOUNT && (
                <p className="breakdown__note">
                    Итоговая цена доставки может снизиться, если волна заполнится сильнее: после закрытия приёма тариф
                    пересчитывается по итоговой загрузке, а разницу мы возвращаем.
                </p>
            )}
        </div>
    )
}
