import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchCatalog } from '../api/search'
import { getWavesLoad } from '../api/waves'
import ErrorMessage from '../components/ErrorMessage'
import { SearchIcon } from '../components/Icons'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { pluralize } from '../utils/format'
import { REGIONS, directionFromRegion } from '../utils/regions'
import { POPULAR_QUERIES, matchPages, rememberSearch } from '../utils/search'

const REGION_FILTERS = [
    { value: '', label: 'Все регионы' },
    { value: 'Якутия', label: 'Якутия' },
    { value: 'ДНР', label: 'Донбасс' },
]

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { isLoggedIn } = useAuth()
    const query = searchParams.get('q') ?? ''
    const [draft, setDraft] = useState(query)
    const [region, setRegion] = useState('')
    const [syncedQuery, setSyncedQuery] = useState(query)
    const debounced = useDebounce(draft.trim(), 300)

    if (query !== syncedQuery) {
        setSyncedQuery(query)
        if (query !== debounced) setDraft(query)
    }

    useDocumentTitle(query ? `Поиск: ${query}` : 'Поиск')

    useEffect(() => {
        if (debounced === query || draft.trim() !== debounced) return
        setSearchParams(debounced ? { q: debounced } : {}, { replace: true })
    }, [debounced, draft, query, setSearchParams])

    useEffect(() => {
        if (query) rememberSearch(query)
    }, [query])

    const { data, error, loading, reload } = useFetch(
        (signal) => (query ? Promise.all([searchCatalog(query, 0, signal), getWavesLoad(signal)]) : Promise.resolve(null)),
        [query]
    )

    const result = data?.[0]
    const waves = data?.[1]
    const products = result ? result.products.filter((p) => !region || p.region === region) : []
    const pages = matchPages(query, { loggedIn: isLoggedIn })

    return (
        <div className="container section search-page">
            <h1 className="page-title">Поиск</h1>

            <form
                className="search-page__form"
                role="search"
                onSubmit={(event) => {
                    event.preventDefault()
                    setSearchParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true })
                }}
            >
                <SearchIcon size={20} />
                <input
                    type="search"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Конфеты, брусника, вафли, Донецк…"
                    aria-label="Что ищем?"
                    autoComplete="off"
                    autoFocus={!query}
                />
                <button type="submit" className="btn btn--primary">
                    Найти
                </button>
            </form>

            {!query && (
                <div className="search-page__start">
                    <p className="muted">Ищите по названию, категории, производителю или городу. Опечатки не страшны.</p>
                    <div className="search-chips">
                        {POPULAR_QUERIES.map((q) => (
                            <button key={q} type="button" className="search-chip search-chip--soft" onClick={() => setDraft(q)}>
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {query && loading && !data && <Loader label="Ищем сладости…" />}
            {query && error && !data && <ErrorMessage error={error} onRetry={reload} />}

            {result && (
                <>
                    <div className="search-page__summary">
                        <p>
                            По запросу «{result.query}» {pluralize(result.total, ['найден', 'найдено', 'найдено'])}{' '}
                            <strong>
                                {result.total} {pluralize(result.total, ['товар', 'товара', 'товаров'])}
                            </strong>
                        </p>
                        {result.total > 0 && (
                            <div className="segmented segmented--compact" role="radiogroup" aria-label="Регион">
                                {REGION_FILTERS.map((option) => (
                                    <label
                                        key={option.value}
                                        className={`segmented__option ${region === option.value ? 'segmented__option--active' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="search-region"
                                            value={option.value}
                                            checked={region === option.value}
                                            onChange={() => setRegion(option.value)}
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {(result.categories.length > 0 || pages.length > 0) && (
                        <div className="search-chips search-page__links">
                            {result.categories.map((c) => (
                                <Link
                                    key={`${c.region}-${c.category}`}
                                    to={`/catalog/${REGIONS[c.region].slug}?category=${encodeURIComponent(c.category)}`}
                                    className="search-chip"
                                >
                                    {c.category} · {REGIONS[c.region].genitive}
                                </Link>
                            ))}
                            {pages.map((page) => (
                                <Link key={page.to} to={page.to} className="search-chip search-chip--soft">
                                    {page.title}
                                </Link>
                            ))}
                        </div>
                    )}

                    {products.length > 0 ? (
                        <div className="product-grid">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} waves={waves[directionFromRegion(product.region)]} />
                            ))}
                        </div>
                    ) : (
                        <div className="state">
                            <p className="state__title">
                                {result.total > 0 ? 'В этом регионе ничего не нашлось' : 'Ничего не нашлось'}
                            </p>
                            {result.suggestion ? (
                                <p className="state__text">
                                    Возможно, вы искали{' '}
                                    <button type="button" className="link-button" onClick={() => setDraft(result.suggestion)}>
                                        «{result.suggestion}»
                                    </button>
                                </p>
                            ) : (
                                <p className="state__text">Попробуйте другое слово: название, категорию или город.</p>
                            )}
                            <div className="state__actions">
                                <Link to="/catalog/yakutia" className="btn btn--primary">
                                    Сладости Якутии
                                </Link>
                                <Link to="/catalog/donbass" className="btn btn--primary">
                                    Сладости Донбасса
                                </Link>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
