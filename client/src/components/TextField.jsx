export default function TextField({ id, label, error, hint, as: Element = 'input', required = false, className = '', children, ...props }) {
    const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

    return (
        <div className={`field ${error ? 'field--error' : ''} ${className}`}>
            <label className="field__label" htmlFor={id}>
                {label}
                {required && (
                    <span className="field__required" aria-hidden="true">
                        {' '}*
                    </span>
                )}
            </label>
            <Element
                id={id}
                className="field__control"
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                aria-required={required || undefined}
                {...props}
            >
                {children}
            </Element>
            {hint && !error && (
                <p id={`${id}-hint`} className="field__hint">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="field__error">
                    {error}
                </p>
            )}
        </div>
    )
}
