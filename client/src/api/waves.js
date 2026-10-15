import { request, toQuery } from './client'

export function getWaves(direction, signal) {
    return request(`/waves${toQuery({ direction })}`, { signal })
}

export function getWavesLoad(signal) {
    return request('/waves/load', { signal })
}

export function getPickupPoints(direction, signal) {
    return request(`/pickup-points${toQuery({ direction })}`, { signal })
}
