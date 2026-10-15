import { SearchIcon } from './Icons'

const SORT_OPTIONS = [
    { value: 'popular', label: 'Сначала популярные' },
    { value: 'price_asc', label: 'Сначала дешевле' },
    { value: 'price_desc', label: 'Сначала дороже' },
    { value: 'new', label: 'Сначала новинки' },
]

export default function Filters({
    values,
    search,
    onSearchChange,
    minPrice,
    onMinPriceChange,
    maxPrice,
    onMaxPriceChange,
    onChange,
    onReset,
    categories,
    manufacturers,
    hasActive,
}) {
    const priceError = minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice)

    return (
        <form className="filters" role="search" onSubmit={(event) => event.preventDefault()} aria-label="Фильтры каталога">
            <div className="filters__search">
                <label htmlFor="filter-search" className="visually-hidden">
                    Поиск по названию, составу и производителю
                </label>
                <SearchIcon size={18} />
                <input
                    id="filter-search"
                    type="search"
                    placeholder="Поиск: «брусника», «вафли», «ЯХК»…"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    autoComplete="off"
                />
            </div>

            <div className="filters__grid">
                <div className="field">
                    <label className="field__label" htmlFor="filter-category">
                        Категория
                    </label>
                    <select
                        id="filter-category"
                        className="field__control"
                        value={values.category}
                        onChange={(event) => onChange('category', event.target.value)}
                    >
                        <option value="">Все категории</option>
                        {categories.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="field">
                    <label className="field__label" htmlFor="filter-manufacturer">
                        Производитель
                    </label>
                    <select
                        id="filter-manufacturer"
                        className="field__control"
                        value={values.manufacturer}
                        onChange={(event) => onChange('manufacturer', event.target.value)}
                    >
                        <option value="">Все производители</option>
                        {manufacturers.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>

                <fieldset className="field filters__price">
                    <legend className="field__label">Цена, ₽</legend>
                    <div className="filters__price-inputs">
                        <input
                            className="field__control"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="от"
                            aria-label="Цена от, рублей"
                            value={minPrice}
                            onChange={(event) => onMinPriceChange(event.target.value)}
                            aria-invalid={priceError || undefined}
                        />
                        <span aria-hidden="true">—</span>
                        <input
                            className="field__control"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="до"
                            aria-label="Цена до, рублей"
                            value={maxPrice}
                            onChange={(event) => onMaxPriceChange(event.target.value)}
                            aria-invalid={priceError || undefined}
                        />
                    </div>
                    {priceError && <p className="field__error">«От» больше, чем «до»</p>}
                </fieldset>

                <div className="field">
                    <label className="field__label" htmlFor="filter-sort">
                        Сортировка
                    </label>
                    <select
                        id="filter-sort"
                        className="field__control"
                        value={values.sort}
                        onChange={(event) => onChange('sort', event.target.value)}
                    >
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="filters__bottom">
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={values.noTempSensitive}
                        onChange={(event) => onChange('noTempSensitive', event.target.checked ? '1' : '')}
                    />
                    <span>Только без термочувствительных</span>
                </label>
                {hasActive && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
                        Сбросить фильтры
                    </button>
                )}
            </div>
        </form>
    )
}
