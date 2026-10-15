import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDebounce } from './useDebounce'

export function useDebouncedParam(urlValue, onCommit, delay = 300) {
    const [value, setValue] = useState(urlValue)
    const debounced = useDebounce(value, delay)
    const committed = useRef(urlValue)
    const onCommitRef = useRef(onCommit)

    useLayoutEffect(() => {
        onCommitRef.current = onCommit
    })

    useEffect(() => {
        if (urlValue !== committed.current) {
            committed.current = urlValue
            setValue(urlValue)
        }
    }, [urlValue])

    useEffect(() => {
        if (debounced !== committed.current) {
            committed.current = debounced
            onCommitRef.current(debounced)
        }
    }, [debounced])

    return [value, setValue]
}
