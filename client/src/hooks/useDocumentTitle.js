import { useEffect } from 'react'

const SITE = 'Сладкий мост'

export function useDocumentTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} — ${SITE}` : `${SITE}: Якутия ⇄ Донбасс`
    }, [title])
}
