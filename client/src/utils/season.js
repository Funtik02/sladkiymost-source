const SEASONS = {
    winter: {
        key: 'winter',
        label: 'Зима',
        thermoRequired: true,
        extraDays: 0,
        reason: 'защита от мороза',
    },
    summer: {
        key: 'summer',
        label: 'Лето',
        thermoRequired: true,
        extraDays: 0,
        reason: 'защита от перегрева',
    },
    offseason: {
        key: 'offseason',
        label: 'Межсезонье',
        thermoRequired: false,
        extraDays: 7,
        reason: 'межсезонье на трассе: срок доставки +7 дней',
    },
    calm: {
        key: 'calm',
        label: 'Без ограничений',
        thermoRequired: false,
        extraDays: 0,
        reason: '',
    },
}

export function getSeason(month) {
    if ([12, 1, 2].includes(month)) return SEASONS.winter
    if ([6, 7, 8].includes(month)) return SEASONS.summer
    if ([5, 11].includes(month)) return SEASONS.offseason
    return SEASONS.calm
}

export function getMonthFromISO(isoDate) {
    return Number(String(isoDate).slice(5, 7))
}

export function getWaveSeason(wave) {
    return getSeason(getMonthFromISO(wave.departureDate))
}
