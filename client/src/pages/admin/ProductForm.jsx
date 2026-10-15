import { useState } from 'react'
import { createProduct, updateProduct } from '../../api/admin'
import ProductPhoto from '../../components/ProductPhoto'
import TextField from '../../components/TextField'
import { useAdmin } from '../../context/AdminContext'

const EMPTY = {
    region: 'Якутия',
    manufacturer: '',
    name: '',
    category: '',
    weight_g: '',
    price_rub: '',
    temp_sensitive: false,
    shelf_life_days: '',
    photo: '',
    description: '',
}

const PHOTO_RE = /^(https?:\/\/\S+|[\w.-]+\.(jpe?g|png|webp|svg|gif))$/i

function validate(values) {
    const errors = {}
    const text = (field, label, min, max) => {
        const value = values[field].trim()
        if (value.length < min) errors[field] = value ? `${label}: минимум ${min} симв.` : `Укажите: ${label.toLowerCase()}`
        else if (value.length > max) errors[field] = `${label}: максимум ${max} симв.`
    }
    const int = (field, label, min, max) => {
        const value = Number(values[field])
        if (values[field] === '' || !Number.isInteger(value) || value < min || value > max) {
            errors[field] = `${label}: целое число от ${min} до ${max}`
        }
    }

    text('manufacturer', 'Производитель', 2, 80)
    text('name', 'Название', 2, 120)
    text('category', 'Категория', 2, 60)
    int('weight_g', 'Вес', 1, 50000)
    int('price_rub', 'Цена', 1, 1000000)
    int('shelf_life_days', 'Срок годности', 1, 3650)
    text('description', 'Описание', 10, 2000)

    const photo = values.photo.trim()
    if (photo && !PHOTO_RE.test(photo)) errors.photo = 'Ссылка http(s)://… или имя файла вида ykt-001.jpg'

    return errors
}

export default function ProductForm({ product, categories, manufacturers, onSaved, onCancel }) {
    const { call } = useAdmin()
    const [values, setValues] = useState(() =>
        product
            ? {
                  ...product,
                  weight_g: String(product.weight_g),
                  price_rub: String(product.price_rub),
                  shelf_life_days: String(product.shelf_life_days),
              }
            : EMPTY
    )
    const [submitted, setSubmitted] = useState(false)
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')

    const errors = submitted ? validate(values) : {}
    const set = (field) => (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
        setValues((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSubmitted(true)
        const found = validate(values)
        if (Object.keys(found).length > 0) {
            document.getElementById(`product-${Object.keys(found)[0]}`)?.focus()
            return
        }

        const body = {
            region: values.region,
            manufacturer: values.manufacturer.trim(),
            name: values.name.trim(),
            category: values.category.trim(),
            weight_g: Number(values.weight_g),
            price_rub: Number(values.price_rub),
            temp_sensitive: values.temp_sensitive,
            shelf_life_days: Number(values.shelf_life_days),
            photo: values.photo.trim(),
            description: values.description.trim(),
        }

        setSaving(true)
        setServerError('')

        try {
            const saved = product ? await call(updateProduct, product.id, body) : await call(createProduct, body)
            onSaved(saved, Boolean(product))
        } catch (error) {
            setServerError(error.message)
            setSaving(false)
        }
    }

    const field = (name) => ({ id: `product-${name}`, value: values[name], onChange: set(name), error: errors[name] })

    return (
        <form className="product-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
                <TextField {...field('region')} as="select" label="Регион" required>
                    <option value="Якутия">Якутия</option>
                    <option value="ДНР">ДНР</option>
                </TextField>
                <TextField {...field('manufacturer')} label="Производитель" required list="manufacturers-list" />
                <TextField {...field('name')} label="Название" required className="form-grid__wide" />
                <TextField {...field('category')} label="Категория" required list="categories-list" />
                <TextField {...field('weight_g')} label="Вес, г" required type="number" min="1" inputMode="numeric" />
                <TextField {...field('price_rub')} label="Цена, ₽" required type="number" min="1" inputMode="numeric" />
                <TextField
                    {...field('shelf_life_days')}
                    label="Срок годности, дней"
                    required
                    type="number"
                    min="1"
                    inputMode="numeric"
                    hint="Меньше 21 дня — товар нельзя будет заказать с доставкой"
                />
                <TextField
                    {...field('photo')}
                    label="Фото"
                    placeholder="ykt-001.svg или https://…"
                    hint="Имя файла из server/public/images или ссылка"
                    className="form-grid__wide"
                />
                <TextField {...field('description')} as="textarea" rows={4} label="Описание и состав" required className="form-grid__wide" />
            </div>

            <datalist id="manufacturers-list">
                {manufacturers.map((m) => (
                    <option key={m} value={m} />
                ))}
            </datalist>
            <datalist id="categories-list">
                {categories.map((c) => (
                    <option key={c} value={c} />
                ))}
            </datalist>

            <label className="checkbox">
                <input type="checkbox" checked={values.temp_sensitive} onChange={set('temp_sensitive')} />
                <span>Чувствителен к температуре (зимой и летом — обязательная термоупаковка)</span>
            </label>

            {values.photo.trim() && PHOTO_RE.test(values.photo.trim()) && (
                <div className="product-form__preview">
                    <ProductPhoto product={{ ...values, photo: values.photo.trim(), name: values.name || 'Предпросмотр' }} />
                </div>
            )}

            {serverError && (
                <p className="notice notice--danger" role="alert">
                    {serverError}
                </p>
            )}

            <div className="confirm__actions">
                <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
                    Отмена
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Сохраняем…' : product ? 'Сохранить изменения' : 'Добавить товар'}
                </button>
            </div>
        </form>
    )
}
