import { formatKg } from './format.js'
import { getMonthFromISO, getSeason } from './season.js'

export const TARIFF_PER_KG = 500
export const MIN_WAVE_KG = 50
export const MAX_WAVE_KG = 300
export const THERMO_PRICE = 150
export const BASE_DELIVERY_DAYS = { min: 10, max: 14 }
export const SHELF_LIFE_RESERVE_DAYS = 7

export const DISCOUNT_TIERS = [
    { fill: 0.8, discount: 0.35 },
    { fill: 0.5, discount: 0.2 },
]

const roundTo = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits

export function calcWeightKg(items) {
    const grams = items.reduce((sum, item) => sum + item.weight_g * item.qty, 0)
    return roundTo(grams / 1000, 3)
}

export function getDiscount(fillRatio) {
    const tier = DISCOUNT_TIERS.find((t) => fillRatio > t.fill)
    return tier ? tier.discount : 0
}

export function isThermoRequired(items, month) {
    return getSeason(month).thermoRequired && items.some((item) => item.temp_sensitive)
}

export function getDeliveryDays(month) {
    const extra = getSeason(month).extraDays
    return {
        min: BASE_DELIVERY_DAYS.min + extra,
        max: BASE_DELIVERY_DAYS.max + extra,
    }
}

export function getRequiredShelfLifeDays(month) {
    return getDeliveryDays(month).max + SHELF_LIFE_RESERVE_DAYS
}

export function isShelfLifeOk(shelfLifeDays, month) {
    return shelfLifeDays >= getRequiredShelfLifeDays(month)
}

export function calcDelivery({ items, wave, thermoChosen = false }) {
    const month = getMonthFromISO(wave.departureDate)
    const maxKg = wave.maxWeightKg || MAX_WAVE_KG
    const weightKg = calcWeightKg(items)
    const waveWeightAfterKg = roundTo(wave.currentWeightKg + weightKg, 3)
    const fillRatio = waveWeightAfterKg / maxKg
    const discount = getDiscount(fillRatio)

    const baseCost = Math.round(weightKg * TARIFF_PER_KG)
    const discountAmount = Math.round(baseCost * discount)
    const thermoRequired = isThermoRequired(items, month)
    const thermoApplied = thermoRequired || Boolean(thermoChosen)
    const thermoCost = thermoApplied ? THERMO_PRICE : 0

    return {
        weightKg,
        tariffPerKg: TARIFF_PER_KG,
        baseCost,
        waveWeightAfterKg,
        fillRatio,
        fillPercent: Math.round(fillRatio * 100),
        discount,
        discountAmount,
        shippingCost: baseCost - discountAmount,
        thermoRequired,
        thermoApplied,
        thermoCost,
        total: baseCost - discountAmount + thermoCost,
        fits: waveWeightAfterKg <= maxKg,
        freeCapacityKg: roundTo(Math.max(0, maxKg - wave.currentWeightKg), 3),
        deliveryDays: getDeliveryDays(month),
    }
}

export function getTariffPerKg(fillRatio) {
    return Math.round(TARIFF_PER_KG * (1 - getDiscount(fillRatio)))
}

export function getNextDiscountTier(totalWaveKg, maxKg = MAX_WAVE_KG) {
    const fill = totalWaveKg / maxKg
    const next = [...DISCOUNT_TIERS].reverse().find((t) => fill <= t.fill)
    if (!next) return null

    const thresholdKg = next.fill * maxKg
    const neededGrams = Math.round(thresholdKg * 1000) - Math.round(totalWaveKg * 1000) + 1
    const neededKg = Math.ceil(neededGrams / 100) / 10

    return { discount: next.discount, thresholdKg, neededKg }
}

export function getExpectedArrival(wave) {
    const days = getDeliveryDays(getMonthFromISO(wave.departureDate))
    return {
        from: addDaysISO(wave.departureDate, days.min),
        to: addDaysISO(wave.departureDate, days.max),
    }
}

export function getExpiringItems(items, wave) {
    const month = getMonthFromISO(wave.departureDate)
    return items.filter((item) => !isShelfLifeOk(item.shelf_life_days, month))
}

export function getWaveBlocker(items, wave) {
    const calc = calcDelivery({ items, wave })
    if (!calc.fits) {
        return `Не помещается: свободно ${formatKg(calc.freeCapacityKg)}, а заказ весит ${formatKg(calc.weightKg)}`
    }

    const expiring = getExpiringItems(items, wave)
    if (expiring.length > 0) {
        return `Не доедет по сроку годности: ${expiring.map((i) => `«${i.name}»`).join(', ')}`
    }

    return null
}

export function checkShelfLife(shelfLifeDays, waves = []) {
    if (waves.length === 0) {
        const requiredDays = BASE_DELIVERY_DAYS.max + SHELF_LIFE_RESERVE_DAYS
        const ok = shelfLifeDays >= requiredDays
        return { canAdd: ok, nearestOk: ok, requiredDays, nearestWave: null, firstOkWave: null }
    }

    const nearestWave = waves[0]
    const requiredDays = getRequiredShelfLifeDays(getMonthFromISO(nearestWave.departureDate))
    const firstOkWave = waves.find((w) => isShelfLifeOk(shelfLifeDays, getMonthFromISO(w.departureDate))) ?? null

    return {
        canAdd: Boolean(firstOkWave),
        nearestOk: shelfLifeDays >= requiredDays,
        requiredDays,
        nearestWave,
        firstOkWave,
    }
}

export function addDaysISO(iso, days) {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + days))
    return date.toISOString().slice(0, 10)
}
