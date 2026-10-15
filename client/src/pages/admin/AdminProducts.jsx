import { useState } from 'react'
import { deleteProduct, getAdminProducts } from '../../api/admin'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import Modal from '../../components/Modal'
import ProductPhoto from '../../components/ProductPhoto'
import RegionBadge from '../../components/RegionBadge'
import { useAdmin } from '../../context/AdminContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useFetch } from '../../hooks/useFetch'
import { formatRub, formatWeight } from '../../utils/format'
import ProductForm from './ProductForm'

const uniq = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'))

export default function AdminProducts() {
    useDocumentTitle('Админка: товары')
    const { call } = useAdmin()
    const { showToast } = useToast()
    const { data, error, loading, reload, setData } = useFetch((signal) => call(getAdminProducts, signal), [])
    const [editing, setEditing] = useState(null)
    const [deleting, setDeleting] = useState(null)
    const [busy, setBusy] = useState(false)
    const [query, setQuery] = useState('')

    if (loading && !data) return <Loader label="Загружаем товары…" />
    if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

    const products = data
    const q = query.trim().toLowerCase()
    const visible = q
        ? products.filter((p) => [p.id, p.name, p.manufacturer, p.category].join(' ').toLowerCase().includes(q))
        : products

    const handleSaved = (saved, isUpdate) => {
        setData((list) => (isUpdate ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]))
        setEditing(null)
        showToast(isUpdate ? `Товар ${saved.id} сохранён` : `Товар ${saved.id} добавлен`)
    }

    const handleDelete = async () => {
        setBusy(true)
        try {
            await call(deleteProduct, deleting.id)
            setData((list) => list.filter((p) => p.id !== deleting.id))
            showToast(`Товар ${deleting.id} удалён`)
            setDeleting(null)
        } catch (err) {
            showToast(err.message, { type: 'error' })
        } finally {
            setBusy(false)
        }
    }

    return (
        <section aria-labelledby="products-title">
            <div className="admin__toolbar">
                <h2 id="products-title" className="section-subtitle">
                    Товары ({products.length})
                </h2>
                <input
                    type="search"
                    className="field__control admin__search"
                    placeholder="Поиск по названию, id, производителю"
                    aria-label="Поиск товаров"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
                    + Добавить товар
                </button>
            </div>

            <div className="table-wrap" tabIndex={0} aria-label="Таблица товаров, прокручивается горизонтально">
                <table className="table">
                    <thead>
                        <tr>
                            <th scope="col">Фото</th>
                            <th scope="col">ID</th>
                            <th scope="col">Название</th>
                            <th scope="col">Регион</th>
                            <th scope="col">Производитель</th>
                            <th scope="col">Категория</th>
                            <th scope="col">Вес</th>
                            <th scope="col">Цена</th>
                            <th scope="col">Термо</th>
                            <th scope="col">Срок, дн.</th>
                            <th scope="col">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((p) => (
                            <tr key={p.id}>
                                <td>
                                    <ProductPhoto product={p} className="table__thumb" />
                                </td>
                                <td className="nowrap">{p.id}</td>
                                <td>{p.name}</td>
                                <td>
                                    <RegionBadge region={p.region} small />
                                </td>
                                <td>{p.manufacturer}</td>
                                <td>{p.category}</td>
                                <td className="nowrap">{formatWeight(p.weight_g)}</td>
                                <td className="nowrap">{formatRub(p.price_rub)}</td>
                                <td>{p.temp_sensitive ? 'да' : '—'}</td>
                                <td className={p.shelf_life_days < 21 ? 'text-danger' : ''}>{p.shelf_life_days}</td>
                                <td className="nowrap">
                                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(p)}>
                                        Изменить
                                    </button>{' '}
                                    <button type="button" className="btn btn--danger-ghost btn--small" onClick={() => setDeleting(p)}>
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={11} className="table__empty">
                                    Ничего не найдено
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                open={Boolean(editing)}
                title={editing === 'new' ? 'Новый товар' : `Редактирование ${editing?.id ?? ''}`}
                onClose={() => setEditing(null)}
                size="lg"
            >
                {editing && (
                    <ProductForm
                        key={editing === 'new' ? 'new' : editing.id}
                        product={editing === 'new' ? null : editing}
                        categories={uniq(products.map((p) => p.category))}
                        manufacturers={uniq(products.map((p) => p.manufacturer))}
                        onSaved={handleSaved}
                        onCancel={() => setEditing(null)}
                    />
                )}
            </Modal>

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Удалить товар?"
                message={deleting ? `«${deleting.name}» (${deleting.id}) исчезнет из каталога. Уже оформленные заказы сохранятся.` : ''}
                confirmLabel="Удалить"
                danger
                busy={busy}
                onConfirm={handleDelete}
                onCancel={() => setDeleting(null)}
            />
        </section>
    )
}
