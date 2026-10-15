const ENDINGS = /(иями|ями|ами|ого|его|ому|ему|ыми|ими|ых|их|ый|ий|ой|ая|яя|ое|ее|ые|ие|ую|юю|ом|ем|ах|ях|ов|ев|ей|ям|ам|а|я|ы|и|у|ю|е|о|ь|й)$/

const REGION_WORDS = {
    Якутия: 'якутия якутск якутский север северный',
    ДНР: 'днр донбасс донецк донецкий юг южный',
}

const FIELDS = [
    { weight: 3, get: (p) => p.name },
    { weight: 2.5, get: (p) => p.category },
    { weight: 2, get: (p) => p.manufacturer },
    { weight: 1.5, get: (p) => REGION_WORDS[p.region] ?? p.region },
    { weight: 0.6, get: (p) => p.description ?? '', strict: true },
]

const MAX_QUERY_LENGTH = 100
const RELEVANCE_CUTOFF = 0.3

function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9%]+/g, ' ')
        .trim()
}

function tokenize(text) {
    const normalized = normalize(text)
    return normalized ? normalized.split(' ') : []
}

function stem(word) {
    if (word.length <= 4) return word
    const stemmed = word.replace(ENDINGS, '')
    return stemmed.length >= 3 ? stemmed : word
}

function commonPrefix(a, b) {
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1
    return i
}

function distance(a, b) {
    if (a === b) return 0
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

    for (let i = 1; i <= a.length; i += 1) {
        const row = [i]
        for (let j = 1; j <= b.length; j += 1) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        prev = row
    }

    return prev[b.length]
}

const allowedTypos = (token) => (token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0)

function matchWord(token, word, strict = false) {
    if (word === token) return 10
    if (token.length >= 2 && word.startsWith(token)) return 8

    const tokenStem = stem(token)
    const wordStem = stem(word)
    if (tokenStem.length >= 4 && wordStem.length >= 4) {
        const shared = commonPrefix(tokenStem, wordStem)
        if (shared >= Math.max(4, Math.min(tokenStem.length, wordStem.length) - 1)) return 6
    }

    if (strict) return 0
    if (token.length >= 3 && word.includes(token)) return 4

    const typos = allowedTypos(token)
    if (typos > 0) {
        const closest = Math.min(distance(token, word), distance(token, word.slice(0, token.length)))
        if (closest <= typos) return 3
    }

    return 0
}

function indexProduct(product) {
    return {
        product,
        name: normalize(product.name),
        firstWord: tokenize(product.name)[0] ?? '',
        fields: FIELDS.map((field) => ({ weight: field.weight, strict: Boolean(field.strict), words: tokenize(field.get(product)) })),
    }
}

function scoreEntry(entry, tokens, phrase) {
    let total = 0

    for (const token of tokens) {
        let best = 0
        for (const field of entry.fields) {
            for (const word of field.words) {
                const score = matchWord(token, word, field.strict) * field.weight
                if (score > best) best = score
            }
        }
        if (best === 0) return 0
        total += best
    }

    if (matchWord(tokens[0], entry.firstWord) > 0) total += 4
    if (entry.name.startsWith(phrase)) total += 12
    else if (entry.name.includes(phrase)) total += 8

    return total
}

function buildVocabulary(products) {
    const words = new Set()
    for (const product of products) {
        for (const text of [product.name, product.category, product.manufacturer, REGION_WORDS[product.region]]) {
            tokenize(text).forEach((word) => word.length >= 4 && words.add(word))
        }
    }
    return [...words]
}

function suggest(tokens, products) {
    const vocabulary = buildVocabulary(products)
    let changed = false

    const fixed = tokens.map((token) => {
        if (token.length < 4 || vocabulary.some((word) => matchWord(token, word) > 0)) return token

        let best = null
        let bestDistance = Infinity
        for (const word of vocabulary) {
            const d = Math.min(distance(token, word), distance(token, word.slice(0, token.length)) + 1)
            if (d < bestDistance) {
                best = word
                bestDistance = d
            }
        }

        if (best && bestDistance <= Math.max(2, Math.floor(token.length / 3))) {
            changed = true
            return best
        }
        return token
    })

    return changed ? fixed.join(' ') : null
}

function matchCategories(products, tokens) {
    const categories = new Map()

    for (const product of products) {
        const words = tokenize(product.category)
        const matches = tokens.every((token) => words.some((word) => matchWord(token, word) > 0))
        if (!matches) continue

        const key = `${product.region}|${product.category}`
        const entry = categories.get(key) ?? { region: product.region, category: product.category, count: 0 }
        entry.count += 1
        categories.set(key, entry)
    }

    return [...categories.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'ru'))
}

function searchProducts(products, sold, query, limit) {
    const text = String(query ?? '').slice(0, MAX_QUERY_LENGTH)
    const tokens = tokenize(text)
    const phrase = tokens.join(' ')

    if (tokens.length === 0) {
        return { query: text.trim(), total: 0, products: [], categories: [], suggestion: null }
    }

    const scored = products
        .map((product) => ({ product, score: scoreEntry(indexProduct(product), tokens, phrase) }))
        .filter((item) => item.score > 0)
    const top = Math.max(0, ...scored.map((item) => item.score))
    const ranked = scored
        .filter((item) => item.score >= top * RELEVANCE_CUTOFF)
        .sort((a, b) => b.score - a.score || (sold.get(b.product.id) ?? 0) - (sold.get(a.product.id) ?? 0))
        .map((item) => item.product)

    return {
        query: text.trim(),
        total: ranked.length,
        products: limit ? ranked.slice(0, limit) : ranked,
        categories: matchCategories(products, tokens),
        suggestion: ranked.length === 0 ? suggest(tokens, products) : null,
    }
}

module.exports = { searchProducts, normalize, tokenize, matchWord }
