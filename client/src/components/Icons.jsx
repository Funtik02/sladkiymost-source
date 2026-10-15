function Icon({ children, size = 22, ...props }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {children}
        </svg>
    )
}

export function HeartIcon({ filled = false, ...props }) {
    return (
        <Icon {...props} fill={filled ? 'currentColor' : 'none'}>
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
        </Icon>
    )
}

export function CartIcon(props) {
    return (
        <Icon {...props}>
            <path d="M5 8h14l-1.3 11.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </Icon>
    )
}

export function MenuIcon(props) {
    return (
        <Icon {...props}>
            <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
    )
}

export function CloseIcon(props) {
    return (
        <Icon {...props}>
            <path d="M6 6l12 12M18 6L6 18" />
        </Icon>
    )
}

export function TrashIcon(props) {
    return (
        <Icon {...props}>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </Icon>
    )
}

export function CopyIcon(props) {
    return (
        <Icon {...props}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </Icon>
    )
}

export function TruckIcon(props) {
    return (
        <Icon {...props}>
            <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
        </Icon>
    )
}

export function CheckIcon(props) {
    return (
        <Icon {...props}>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </Icon>
    )
}

export function RefreshIcon(props) {
    return (
        <Icon {...props}>
            <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
        </Icon>
    )
}

export function SearchIcon(props) {
    return (
        <Icon {...props}>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </Icon>
    )
}

export function SnowflakeIcon(props) {
    return (
        <Icon {...props}>
            <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
        </Icon>
    )
}

export function SunIcon(props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </Icon>
    )
}

export function ThermometerIcon(props) {
    return (
        <Icon {...props}>
            <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />
        </Icon>
    )
}

export function GiftIcon(props) {
    return (
        <Icon {...props}>
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M5 12v8h14v-8M12 8v12" />
            <path d="M12 8c-1-2.5-2.5-4-4-4a2 2 0 0 0 0 4h4zM12 8c1-2.5 2.5-4 4-4a2 2 0 0 1 0 4h-4z" />
        </Icon>
    )
}

export function BoxIcon(props) {
    return (
        <Icon {...props}>
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8M12 13v8" />
        </Icon>
    )
}

export function TrendDownIcon(props) {
    return (
        <Icon {...props}>
            <path d="M3 7l6 6 4-4 8 8M21 11v6h-6" />
        </Icon>
    )
}

export function ArrowsIcon(props) {
    return (
        <Icon {...props}>
            <path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5" />
        </Icon>
    )
}

const CATEGORY_ICON_PATHS = {
    Конфеты: 'M8.5 10 4 7.5v9L8.5 14M15.5 10 20 7.5v9L15.5 14M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
    Шоколад: 'M7.5 3h9A1.5 1.5 0 0 1 18 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3zM6 9h12M6 15h12M12 3v18',
    Пряники: 'M7 6h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4zM12 12h.01',
    Печенье: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 9h.01M15 10h.01M10 15h.01M14.5 14.5h.01',
    Зефир: 'M14 13a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM12.2 6.6A5 5 0 1 1 13.7 16',
    Торты: 'M4 20h16M5 20v-7h14v7M5 16.5c2.3 1.3 4.7-1.3 7 0s4.7 1.3 7 0M12 13V9.5M12 7a1.2 1.2 0 0 1-1.2-1.2C10.8 4.8 12 3.5 12 3.5s1.2 1.3 1.2 2.3A1.2 1.2 0 0 1 12 7z',
    Карамель: 'M18 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0zM12 15v6M12 9a2.5 2.5 0 1 1 2.5-2.5',
    Вафли: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16',
    Мармелад: 'M5 18c0-5 3-9 7-9s7 4 7 9zM10 14.5h.01M14 13.5h.01',
}

export function CategoryIcon({ category, ...props }) {
    const d = CATEGORY_ICON_PATHS[category === 'Шоколадные конфеты' ? 'Конфеты' : category] ?? CATEGORY_ICON_PATHS.Конфеты
    return (
        <Icon {...props}>
            <path d={d} />
        </Icon>
    )
}

export function UserIcon(props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
        </Icon>
    )
}

export function SoundIcon({ muted = false, ...props }) {
    return (
        <Icon {...props}>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            {muted ? (
                <path d="M16 9.5l5 5M21 9.5l-5 5" />
            ) : (
                <>
                    <path d="M15.5 9a4 4 0 0 1 0 6" />
                    <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
                </>
            )}
        </Icon>
    )
}
