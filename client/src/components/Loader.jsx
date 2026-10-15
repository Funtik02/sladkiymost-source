export default function Loader({ label = 'Загружаем…', inline = false }) {
    return (
        <div className={inline ? 'loader loader--inline' : 'loader'} role="status">
            <span className="loader__spinner" aria-hidden="true" />
            <span className="loader__label">{label}</span>
        </div>
    )
}
