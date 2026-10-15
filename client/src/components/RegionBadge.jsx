import { REGIONS } from '../utils/regions'
import { SnowflakeIcon, SunIcon } from './Icons'

export default function RegionBadge({ region, small = false }) {
    const info = REGIONS[region]
    if (!info) return null

    return (
        <span className={`region-badge region-badge--${info.theme} ${small ? 'region-badge--small' : ''}`}>
            {info.theme === 'yakutia' ? <SnowflakeIcon size={13} /> : <SunIcon size={13} />}
            {region}
        </span>
    )
}
