export const REGIONS = {
    Якутия: {
        name: 'Якутия',
        slug: 'yakutia',
        title: 'Сладости Якутии',
        genitive: 'Якутии',
        city: 'Якутск',
        direction: 'YKT_DNR',
        theme: 'yakutia',
    },
    ДНР: {
        name: 'ДНР',
        slug: 'donbass',
        title: 'Сладости Донбасса',
        genitive: 'ДНР',
        city: 'Донецк',
        direction: 'DNR_YKT',
        theme: 'donbass',
    },
}

export const REGION_BY_SLUG = {
    yakutia: REGIONS['Якутия'],
    donbass: REGIONS['ДНР'],
}

export const DIRECTIONS = {
    YKT_DNR: {
        code: 'YKT_DNR',
        label: 'Якутия → ДНР',
        fromRegion: 'Якутия',
        toRegion: 'ДНР',
        fromCity: 'Якутск',
        toCity: 'Донецк',
    },
    DNR_YKT: {
        code: 'DNR_YKT',
        label: 'ДНР → Якутия',
        fromRegion: 'ДНР',
        toRegion: 'Якутия',
        fromCity: 'Донецк',
        toCity: 'Якутск',
    },
}

export const DIRECTION_CODES = Object.keys(DIRECTIONS)

export function directionFromRegion(region) {
    return REGIONS[region]?.direction ?? null
}

export function directionToRegion(region) {
    return Object.values(DIRECTIONS).find((d) => d.toRegion === region)?.code ?? null
}

export const ORDER_STATUSES = ['accepted', 'assembling', 'in_transit', 'at_pickup', 'received']

export const ORDER_STATUS_LABELS = {
    accepted: 'Принят',
    assembling: 'В сборке',
    in_transit: 'В пути',
    at_pickup: 'На пункте выдачи',
    received: 'Получен',
}

export const WAVE_STATUS_LABELS = {
    open: 'Приём заказов',
    closed: 'Приём закрыт, сборка',
    departed: 'Отправлена',
    merged: 'Перенесена и объединена',
}
