export default function ErrorMessage({ error, onRetry, title = 'Не удалось загрузить данные' }) {
    return (
        <div className="state state--error" role="alert">
            <p className="state__title">{title}</p>
            {error?.message && <p className="state__text">{error.message}</p>}
            {onRetry && (
                <button type="button" className="btn btn--primary" onClick={onRetry}>
                    Повторить
                </button>
            )}
        </div>
    )
}
