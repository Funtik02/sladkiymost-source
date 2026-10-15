import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCategories, getManufacturers, getProducts } from '../api/products'
import { getWaves } from '../api/waves'
import ErrorMessage from '../components/ErrorMessage'
import Filters from '../components/Filters'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import WaveInfo from '../components/WaveInfo'
import { useDebouncedParam } from '../hooks/useDebouncedParam'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFetch } from '../hooks/useFetch'
import { pluralize } from '../utils/format'
import { REGION_BY_SLUG } from '../utils/regions'
import NotFound from './NotFound'

const DEFAULT_SORT = 'popular'

export default function Catalog() {
    const { region: slug } = useParams()
    const region = REGION_BY_SLUG[slug]

    if (!region) return <NotFound />

    return <CatalogView key={region.slug} region={region} />
}

function CatalogView({ region }) {
    useDocumentTitle(region.title)
    const [searchParams, setSearchParams] = useSearchParams()

    const values = {
        category: searchParams.get('category') ?? '',
        manufacturer: searchParams.get('manufacturer') ?? '',
        minPrice: searchParams.get('minPrice') ?? '',
        maxPrice: searchParams.get('maxPrice') ?? '',
        search: searchParams.get('search') ?? '',
        sort: searchParams.get('sort') || DEFAULT_SORT,
        noTempSensitive: searchParams.get('noTempSensitive') === '1',
    }

    const updateParam = useCallback(
        (name, value) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    if (value === '' || (name === 'sort' && value === DEFAULT_SORT)) next.delete(name)
                    else next.set(name, value)
                    return next
                },
                { replace: true }
            )
        },
        [setSearchParams]
    )

    const [search, setSearch] = useDebouncedParam(values.search, (v) => updateParam('search', v))
    const [minPrice, setMinPrice] = useDebouncedParam(values.minPrice, (v) => updateParam('minPrice', v))
    const [maxPrice, setMaxPrice] = useDebouncedParam(values.maxPrice, (v) => updateParam('maxPrice', v))

    const resetFilters = () => {
        setSearch('')
        setMinPrice('')
        setMaxPrice('')
        setSearchParams({}, { replace: true })
    }

    const hasActive =
        Boolean(values.category || values.manufacturer || values.minPrice || values.maxPrice || values.search) ||
        values.noTempSensitive ||
        values.sort !== DEFAULT_SORT ||
        Boolean(search || minPrice || maxPrice)

    const products = useFetch(
        (signal) =>
            getProducts(
                {
                    region: region.name,
                    category: values.category,
                    manufacturer: values.manufacturer,
                    minPrice: values.minPrice,
                    maxPrice: values.maxPrice,
                    search: values.search.trim(),
                    sort: values.sort,
                    noTempSensitive: values.noTempSensitive ? 1 : '',
                },
                signal
            ),
        [region.name, searchParams.toString()]
    )

    const options = useFetch(
        (signal) => Promise.all([getCategories(region.name, signal), getManufacturers(region.name, signal)]),
        [region.name]
    )

    const waves = useFetch((signal) => getWaves(region.direction, signal), [region.direction])

    const [categories, manufacturers] = options.data ?? [[], []]
    const list = products.data ?? []

    return (
        <div className={`theme-${region.theme}`}>
            <section className="catalog-hero">
                <div className="container">
                    <nav className="breadcrumbs" aria-label="Хлебные крошки">
                        <Link to="/">Главная</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">{region.title}</span>
                    </nav>
                    <h1 className="page-title">{region.title}</h1>
                    <p className="catalog-hero__text">
                        {region.name === 'Якутия'
                            ? 'Северные сладости фабрики ЯХК: брусника, голубика и кедровый орех в шоколаде, печатные пряники и зефир.'
                            : 'Южные сладости донецких производителей: вафли, мармелад из абрикосов и вишни, печенье и шоколад.'}{' '}
                        Доставка в {region.name === 'Якутия' ? 'Донецк' : 'Якутск'} сборной волной.
                    </p>

                    {waves.loading && !waves.data && <Loader inline label="Загружаем ближайшую волну…" />}
                    {waves.error && !waves.data && (
                        <p className="inline-error" role="alert">
                            Не удалось загрузить расписание волн.{' '}
                            <button type="button" className="link-button" onClick={waves.reload}>
                                Повторить
                            </button>
                        </p>
                    )}
                    {waves.data && <WaveInfo direction={region.direction} wave={waves.data[0]} compact />}
                </div>
            </section>

            <div className="container catalog">
                <Filters
                    values={values}
                    search={search}
                    onSearchChange={setSearch}
                    minPrice={minPrice}
                    onMinPriceChange={setMinPrice}
                    maxPrice={maxPrice}
                    onMaxPriceChange={setMaxPrice}
                    onChange={updateParam}
                    onReset={resetFilters}
                    categories={categories}
                    manufacturers={manufacturers}
                    hasActive={hasActive}
                />

                <p className="catalog__count" aria-live="polite">
                    {!products.loading && !products.error &&
                        `Найдено: ${list.length} ${pluralize(list.length, ['товар', 'товара', 'товаров'])}`}
                </p>

                {products.loading ? (
                    <Loader label="Загружаем товары…" />
                ) : products.error ? (
                    <ErrorMessage error={products.error} onRetry={products.reload} title="Не удалось загрузить товары" />
                ) : list.length === 0 ? (
                    <div className="state">
                        <p className="state__title">Товары не найдены</p>
                        <p className="state__text">Попробуйте изменить условия поиска или сбросить фильтры.</p>
                        <button type="button" className="btn btn--primary" onClick={resetFilters}>
                            Сбросить фильтры
                        </button>
                    </div>
                ) : (
                    <div className="product-grid">
                        {list.map((product) => (
                            <ProductCard key={product.id} product={product} waves={waves.data ?? []} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
