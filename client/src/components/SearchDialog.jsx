import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { searchCatalog } from '../api/search'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import { formatRub } from '../utils/format'
import { REGIONS } from '../utils/regions'
import { POPULAR_QUERIES, forgetSearches, getRecentSearches, matchPages, rememberSearch, searchPageUrl } from '../utils/search'
import Highlight from './Highlight'
import { SearchIcon } from './Icons'
import Modal from './Modal'
import ProductPhoto from './ProductPhoto'

const SUGGEST_LIMIT = 6

function categoryUrl({ region, category }) {
    return `/catalog/${REGIONS[region].slug}?category=${encodeURIComponent(category)}`
}

export default function SearchDialog({ open, onClose }) {
    return (
        <Modal open={open} title="Поиск по сладостям" onClose={onClose} size="lg">
            {open && <SearchPanel onClose={onClose} />}
        </Modal>
    )
}

function SearchPanel({ onClose }) {
    const navigate = useNavigate()
    const { isLoggedIn } = useAuth()
    const listId = useId()
    const [query, setQuery] = useState('')
    const [recent, setRecent] = useState(getRecentSearches)
    const [result, setResult] = useState({ query: '', data: null, error: null })
    const [active, setActive] = useState(-1)
    const debounced = useDebounce(query.trim(), 200)

    useEffect(() => {
        if (!debounced) return undefined

        const controller = new AbortController()
        searchCatalog(debounced, SUGGEST_LIMIT, controller.signal)
            .then((data) => setResult({ query: debounced, data, error: null }))
            .catch((error) => {
                if (error.name !== 'AbortError') setResult({ query: debounced, data: null, error })
            })

        return () => controller.abort()
    }, [debounced])

    const trimmed = query.trim()
    const data = trimmed && result.query === debounced ? result.data : null
    const loading = Boolean(trimmed) && (debounced !== trimmed || result.query !== debounced)
    const pages = matchPages(trimmed, { loggedIn: isLoggedIn })

    const items = []
    if (data) {
        data.products.forEach((product) => items.push({ key: `p-${product.id}`, to: `/product/${product.id}`, type: 'product', product }))
        data.categories.slice(0, 4).forEach((c) => items.push({ key: `c-${c.region}-${c.category}`, to: categoryUrl(c), type: 'category', category: c }))
    }
    if (trimmed) pages.slice(0, 3).forEach((page) => items.push({ key: `s-${page.to}`, to: page.to, type: 'page', page }))
    if (data && data.total > 0) items.push({ key: 'all', to: searchPageUrl(trimmed), type: 'all' })

    const allIndex = items.findIndex((item) => item.type === 'all')

    const go = (to) => {
        if (trimmed) rememberSearch(trimmed)
        onClose()
        navigate(to)
    }

    const onKeyDown = (event) => {
        if (event.key === 'ArrowDown' && items.length > 0) {
            event.preventDefault()
            setActive((i) => (i + 1) % items.length)
        } else if (event.key === 'ArrowUp' && items.length > 0) {
            event.preventDefault()
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
        } else if (event.key === 'Enter') {
            event.preventDefault()
            if (active >= 0 && items[active]) go(items[active].to)
            else if (trimmed) go(searchPageUrl(trimmed))
        }
    }

    const onChange = (event) => {
        setQuery(event.target.value)
        setActive(-1)
    }

    const groups = [
        ['product', 'Товары'],
        ['category', 'Категории'],
        ['page', 'Разделы сайта'],
    ]

    return (
        <div className="search-panel">
            <div className="search-panel__field">
                <SearchIcon size={20} />
                <input
                    type="search"
                    value={query}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder="Конфеты, брусника, вафли, Донецк…"
                    aria-label="Что ищем?"
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    data-autofocus
                />
                {loading && <span className="search-panel__spinner" aria-hidden="true" />}
            </div>

            {!trimmed && (
                <div className="search-panel__start">
                    {recent.length > 0 && (
                        <div className="search-panel__group">
                            <div className="search-panel__group-head">
                                <p className="search-panel__label">Вы искали</p>
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => {
                                        forgetSearches()
                                        setRecent([])
                                    }}
                                >
                                    Очистить
                                </button>
                            </div>
                            <div className="search-chips">
                                {recent.map((q) => (
                                    <button key={q} type="button" className="search-chip" onClick={() => setQuery(q)}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="search-panel__group">
                        <p className="search-panel__label">Часто ищут</p>
                        <div className="search-chips">
                            {POPULAR_QUERIES.map((q) => (
                                <button key={q} type="button" className="search-chip search-chip--soft" onClick={() => setQuery(q)}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ul id={listId} className="search-results" role="listbox" aria-label="Результаты поиска">
                {groups.map(([type, label]) => {
                    const group = items.map((item, index) => ({ item, index })).filter(({ item }) => item.type === type)
                    if (group.length === 0) return null

                    return (
                        <li key={type} role="presentation">
                            <p className="search-panel__label">{label}</p>
                            <ul role="presentation">
                                {group.map(({ item, index }) => (
                                    <li key={item.key} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                                        <Link
                                            to={item.to}
                                            className={`search-result ${index === active ? 'search-result--active' : ''}`}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                go(item.to)
                                            }}
                                            onMouseEnter={() => setActive(index)}
                                            tabIndex={-1}
                                        >
                                            <ResultContent item={item} query={trimmed} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    )
                })}
                {allIndex >= 0 && (
                    <li role="presentation">
                        <Link
                            id={`${listId}-${allIndex}`}
                            role="option"
                            aria-selected={allIndex === active}
                            to={items[allIndex].to}
                            className={`search-results__all ${allIndex === active ? 'search-results__all--active' : ''}`}
                            onClick={(event) => {
                                event.preventDefault()
                                go(items[allIndex].to)
                            }}
                            onMouseEnter={() => setActive(allIndex)}
                            tabIndex={-1}
                        >
                            Все результаты: {data.total} →
                        </Link>
                    </li>
                )}
            </ul>

            {data && data.total === 0 && pages.length === 0 && (
                <div className="search-panel__empty">
                    <p className="search-panel__empty-title">Ничего не нашлось по запросу «{data.query}»</p>
                    {data.suggestion ? (
                        <p>
                            Возможно, вы искали{' '}
                            <button type="button" className="link-button" onClick={() => setQuery(data.suggestion)}>
                                «{data.suggestion}»
                            </button>
                        </p>
                    ) : (
                        <p>Попробуйте другое слово: название, категорию или город.</p>
                    )}
                </div>
            )}

            {result.error && result.query === debounced && trimmed && (
                <p className="search-panel__empty" role="alert">
                    Не удалось выполнить поиск: {result.error.message}
                </p>
            )}

            <p className="search-panel__hint" aria-hidden="true">
                <kbd>↑</kbd> <kbd>↓</kbd> — выбрать, <kbd>Enter</kbd> — открыть, <kbd>Esc</kbd> — закрыть
            </p>
        </div>
    )
}

function ResultContent({ item, query }) {
    if (item.type === 'product') {
        const { product } = item
        return (
            <>
                <ProductPhoto product={product} className="search-result__photo" />
                <span className="search-result__text">
                    <span className="search-result__title">
                        <Highlight text={product.name} query={query} />
                    </span>
                    <span className="search-result__meta">
                        {product.manufacturer} · {product.category} · {REGIONS[product.region]?.city}
                    </span>
                </span>
                <span className="search-result__price">{formatRub(product.price_rub)}</span>
            </>
        )
    }

    if (item.type === 'category') {
        const { category } = item
        return (
            <span className="search-result__text">
                <span className="search-result__title">
                    <Highlight text={category.category} query={query} />
                </span>
                <span className="search-result__meta">
                    {REGIONS[category.region]?.title} · товаров: {category.count}
                </span>
            </span>
        )
    }

    return (
        <span className="search-result__text">
            <span className="search-result__title">{item.page.title}</span>
            <span className="search-result__meta">Раздел сайта</span>
        </span>
    )
}
