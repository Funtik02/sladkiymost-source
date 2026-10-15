import { request, toQuery } from './client'

export function searchCatalog(q, limit, signal) {
    return request(`/search${toQuery({ q, limit })}`, { signal })
}
