import { ArrowsIcon, SnowflakeIcon, SunIcon } from './Icons'

const ICONS = { snowflake: SnowflakeIcon, sun: SunIcon, arrows: ArrowsIcon }

export default function DesignIcon({ icon, ...props }) {
    const Component = ICONS[icon] ?? SnowflakeIcon
    return <Component strokeWidth="1.5" {...props} />
}
