const { getSeason, getMonthFromISO } = require('./season')

const TARIFF_PER_KG = 500
const MIN_WAVE_KG = 50
const MAX_WAVE_KG = 300
const THERMO_PRICE = 150
const BASE_DELIVERY_DAYS = { min: 10, max: 14 }
const SHELF_LIFE_RESERVE_DAYS = 7

const DISCOUNT_TIERS = [
    { fill: 0.8, discount: 0.35 },
    { fill: 0.5, discount: 0.2 },
]

const roundTo = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits

function calcWeightKg(items) {
    const grams = items.reduce((sum, item) => sum + item.weight_g * item.qty, 0)
    return roundTo(grams / 1000, 3)
}

function getDiscount(fillRatio) {
    const tier = DISCOUNT_TIERS.find((t) => fillRatio > t.fill)
    return tier ? tier.discount : 0
}

function isThermoRequired(items, month) {
    return getSeason(month).thermoRequired && items.some((item) => item.temp_sensitive)
}

function getDeliveryDays(month) {
    const extra = getSeason(month).extraDays
    return {
        min: BASE_DELIVERY_DAYS.min + extra,
        max: BASE_DELIVERY_DAYS.max + extra,
    }
}

function getRequiredShelfLifeDays(month) {
    return getDeliveryDays(month).max + SHELF_LIFE_RESERVE_DAYS
}

function isShelfLifeOk(shelfLifeDays, month) {
    return shelfLifeDays >= getRequiredShelfLifeDays(month)
}

function calcDelivery({ items, wave, thermoChosen = false }) {
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

module.exports = {
    TARIFF_PER_KG,
    MIN_WAVE_KG,
    MAX_WAVE_KG,
    THERMO_PRICE,
    roundTo,
    calcWeightKg,
    getDiscount,
    isThermoRequired,
    getDeliveryDays,
    getRequiredShelfLifeDays,
    isShelfLifeOk,
    calcDelivery,
}
