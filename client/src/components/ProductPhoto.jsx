import { useState } from 'react'
import { photoUrl } from '../utils/format'
import { REGIONS } from '../utils/regions'
import { CategoryIcon } from './Icons'

export default function ProductPhoto({ product, className = '', eager = false }) {
    const src = photoUrl(product.photo)
    const [failedSrc, setFailedSrc] = useState(null)
    const theme = REGIONS[product.region]?.theme ?? 'yakutia'

    if (!src || failedSrc === src) {
        return (
            <div className={`photo-fallback photo-fallback--${theme} ${className}`} role="img" aria-label={product.name}>
                <CategoryIcon category={product.category} size={56} strokeWidth="1.4" />
            </div>
        )
    }

    return (
        <img
            className={className}
            src={src}
            alt={product.name}
            width="400"
            height="300"
            loading={eager ? 'eager' : 'lazy'}
            onError={() => setFailedSrc(src)}
        />
    )
}
