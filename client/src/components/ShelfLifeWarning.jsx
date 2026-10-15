import { checkShelfLife, getDeliveryDays, SHELF_LIFE_RESERVE_DAYS } from '../utils/delivery'
import { formatDate } from '../utils/format'
import { getMonthFromISO } from '../utils/season'

export default function ShelfLifeWarning({ shelfLifeDays, waves }) {
    const check = checkShelfLife(shelfLifeDays, waves)
    if (check.nearestOk) return null

    const maxDays = check.nearestWave
        ? getDeliveryDays(getMonthFromISO(check.nearestWave.departureDate)).max
        : check.requiredDays - SHELF_LIFE_RESERVE_DAYS

    if (!check.canAdd) {
        return (
            <div className="notice notice--danger" role="alert">
                <p className="notice__title">Не успеет доехать</p>
                <p>
                    Срок годности — {shelfLifeDays} дн., а нужно не меньше {check.requiredDays} дн.: до {maxDays} дн. в
                    пути и {SHELF_LIFE_RESERVE_DAYS} дн. запаса. Этот товар нельзя заказать с доставкой волной.
                </p>
            </div>
        )
    }

    return (
        <div className="notice notice--warning">
            <p className="notice__title">Не подходит для ближайшей волны</p>
            <p>
                С волной от {formatDate(check.nearestWave.departureDate)} доставка займёт до {maxDays} дн. — срока
                годности ({shelfLifeDays} дн.) не хватит. Подойдёт волна от {formatDate(check.firstOkWave.departureDate)}:
                выберите её в корзине.
            </p>
        </div>
    )
}
