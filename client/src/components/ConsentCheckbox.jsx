import { Link } from 'react-router-dom'

const CONSENT_FIELD_ID = 'personal-data-consent'

export default function ConsentCheckbox({ checked, onChange, error }) {
    const errorId = `${CONSENT_FIELD_ID}-error`

    return (
        <div className={`consent ${error ? 'consent--error' : ''}`}>
            <label className="checkbox">
                <input
                    id={CONSENT_FIELD_ID}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                />
                <span>
                    Я согласен на обработку персональных данных в соответствии с{' '}
                    <Link to="/privacy" target="_blank" className="link">
                        политикой конфиденциальности
                    </Link>
                </span>
            </label>
            {error && (
                <p id={errorId} className="field__error">
                    {error}
                </p>
            )}
        </div>
    )
}
