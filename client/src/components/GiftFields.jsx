import { CARD_DESIGNS, CARD_TEXT_MAX } from '../utils/gift'
import GiftCardPreview from './GiftCardPreview'
import DesignIcon from './DesignIcon'
import PickupSelect from './PickupSelect'
import TextField from './TextField'

export default function GiftFields({ form, errors, onChange, onBlur, pickupPoints, city }) {
    const field = (path, props) => ({
        id: `gift-${path.replace('.', '-')}`,
        error: errors[path],
        onBlur: () => onBlur(path),
        onChange: (event) => onChange(path, event.target.value),
        ...props,
    })

    return (
        <div className="gift-fields">
            <div className="gift-fields__form">
                <fieldset className="form-section">
                    <legend className="form-section__title">Отправитель — это вы</legend>
                    <div className="form-grid">
                        <TextField {...field('customer.name')} label="Имя" required value={form.customer.name} autoComplete="name" />
                        <TextField
                            {...field('customer.phone')}
                            label="Телефон"
                            required
                            type="tel"
                            value={form.customer.phone}
                            autoComplete="tel"
                            placeholder="+7 914 123-45-67"
                        />
                        <TextField
                            {...field('customer.email')}
                            label="Email"
                            required
                            type="email"
                            value={form.customer.email}
                            autoComplete="email"
                            placeholder="name@mail.ru"
                            className="form-grid__wide"
                        />
                    </div>
                </fieldset>

                <fieldset className="form-section">
                    <legend className="form-section__title">Получатель в городе {city}</legend>
                    <div className="form-grid">
                        <TextField {...field('recipient.name')} label="Имя получателя" required value={form.recipient.name} />
                        <TextField
                            {...field('recipient.phone')}
                            label="Телефон получателя"
                            required
                            type="tel"
                            value={form.recipient.phone}
                            placeholder="+7 949 123-45-67"
                        />
                        <div className="form-grid__wide">
                            <PickupSelect
                                id="gift-pickup"
                                value={form.pickupPointId}
                                onChange={(value) => onChange('pickupPointId', value)}
                                onBlur={() => onBlur('pickupPointId')}
                                error={errors.pickupPointId}
                                points={pickupPoints}
                                city={city}
                            />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="form-section">
                    <legend className="form-section__title">Открытка</legend>
                    <TextField
                        {...field('gift.cardText')}
                        as="textarea"
                        label="Текст открытки"
                        rows={4}
                        maxLength={CARD_TEXT_MAX}
                        value={form.gift.cardText}
                        placeholder="Пара тёплых слов получателю"
                        hint={`${form.gift.cardText.length} / ${CARD_TEXT_MAX} символов`}
                    />

                    <div className="design-picker" role="radiogroup" aria-label="Дизайн открытки">
                        {CARD_DESIGNS.map((design) => (
                            <label
                                key={design.id}
                                className={`design-option design-option--${design.id} ${form.gift.cardDesign === design.id ? 'design-option--selected' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="cardDesign"
                                    value={design.id}
                                    checked={form.gift.cardDesign === design.id}
                                    onChange={() => onChange('gift.cardDesign', design.id)}
                                />
                                <span className="design-option__swatch" aria-hidden="true">
                                    <DesignIcon icon={design.icon} size={22} />
                                </span>
                                <span>{design.label}</span>
                            </label>
                        ))}
                    </div>

                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={form.gift.hidePrice}
                            onChange={(event) => onChange('gift.hidePrice', event.target.checked)}
                        />
                        <span>Не показывать цену получателю — на странице отслеживания суммы будут скрыты</span>
                    </label>
                </fieldset>
            </div>

            <aside className="gift-fields__preview" aria-label="Предпросмотр открытки">
                <p className="gift-fields__preview-title">Так увидит открытку получатель</p>
                <GiftCardPreview
                    design={form.gift.cardDesign}
                    text={form.gift.cardText}
                    from={form.customer.name.trim()}
                    to={form.recipient.name.trim()}
                />
            </aside>
        </div>
    )
}
