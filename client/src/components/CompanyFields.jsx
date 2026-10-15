import { isEntrepreneurInn } from '../utils/company'
import PickupSelect from './PickupSelect'
import TextField from './TextField'

export default function CompanyFields({ form, errors, onChange, onBlur, pickupPoints, city }) {
    const field = (path, props) => ({
        id: `company-${path.replace('.', '-')}`,
        error: errors[path],
        onBlur: () => onBlur(path),
        onChange: (event) => onChange(path, event.target.value),
        ...props,
    })

    const entrepreneur = isEntrepreneurInn(form.company.inn)

    return (
        <>
            <fieldset className="form-section">
                <legend className="form-section__title">Организация</legend>
                <div className="form-grid">
                    <TextField
                        {...field('company.name')}
                        label="Название"
                        required
                        value={form.company.name}
                        autoComplete="organization"
                        placeholder="ООО «Север» или ИП Иванов И. И."
                        className="form-grid__wide"
                    />
                    <TextField
                        {...field('company.inn', {
                            onChange: (event) => onChange('company.inn', event.target.value.replace(/\D/g, '').slice(0, 12)),
                        })}
                        label="ИНН"
                        required
                        value={form.company.inn}
                        inputMode="numeric"
                        placeholder="10 или 12 цифр"
                        hint={entrepreneur ? 'ИНН индивидуального предпринимателя' : undefined}
                    />
                    <TextField
                        {...field('company.kpp', {
                            onChange: (event) =>
                                onChange('company.kpp', event.target.value.toUpperCase().replace(/[^\dA-Z]/g, '').slice(0, 9)),
                        })}
                        label={entrepreneur ? 'КПП (у ИП нет)' : 'КПП'}
                        required={!entrepreneur}
                        value={form.company.kpp}
                        placeholder="9 символов"
                    />
                    <TextField
                        {...field('company.address')}
                        label="Юридический адрес"
                        required
                        value={form.company.address}
                        placeholder="677000, г. Якутск, ул. Ленина, д. 1, оф. 5"
                        className="form-grid__wide"
                    />
                </div>
            </fieldset>

            <fieldset className="form-section">
                <legend className="form-section__title">Контактное лицо и получение в городе {city}</legend>
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
                        label="Email для счёта и документов"
                        required
                        type="email"
                        value={form.customer.email}
                        autoComplete="email"
                        placeholder="buh@company.ru"
                        className="form-grid__wide"
                    />
                    <div className="form-grid__wide">
                        <PickupSelect
                            id="company-pickup"
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
        </>
    )
}
