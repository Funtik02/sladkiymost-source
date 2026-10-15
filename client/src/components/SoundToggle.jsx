import { useSyncExternalStore } from 'react'
import { isSoundEnabled, setSoundEnabled, subscribeSound } from '../utils/sound'
import { SoundIcon } from './Icons'

export default function SoundToggle({ className = '', withLabel = false }) {
    const enabled = useSyncExternalStore(subscribeSound, isSoundEnabled)
    const label = enabled ? 'Выключить звуки' : 'Включить звуки'

    return (
        <button
            type="button"
            className={className}
            onClick={() => setSoundEnabled(!enabled)}
            aria-pressed={enabled}
            aria-label={withLabel ? undefined : label}
            title={label}
            data-sound="none"
        >
            <SoundIcon muted={!enabled} size={withLabel ? 20 : 22} />
            {withLabel && <span>{enabled ? 'Звуки включены' : 'Звуки выключены'}</span>}
        </button>
    )
}
