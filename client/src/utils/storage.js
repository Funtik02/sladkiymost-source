export function readJSON(storage, key, fallback) {
    try {
        const raw = storage.getItem(key)
        return raw === null ? fallback : JSON.parse(raw)
    } catch {
        return fallback
    }
}

export function writeJSON(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value))
    } catch {
    }
}

export function removeKey(storage, key) {
    try {
        storage.removeItem(key)
    } catch {
    }
}
