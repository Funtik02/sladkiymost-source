import { HeartIcon } from './Icons'

export default function FavoriteButton({ active, onToggle, name, className = '' }) {
    return (
        <button
            type="button"
            className={`fav-button ${active ? 'fav-button--active' : ''} ${className}`}
            onClick={onToggle}
            data-sound={active ? 'unfavorite' : 'favorite'}
            aria-pressed={active}
            aria-label={active ? `Убрать «${name}» из избранного` : `Добавить «${name}» в избранное`}
        >
            <HeartIcon filled={active} size={20} />
        </button>
    )
}
