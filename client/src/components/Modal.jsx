import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './Icons'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, title, onClose, children, size = 'md', closable = true }) {
    const titleId = useId()
    const dialogRef = useRef(null)
    const onCloseRef = useRef(onClose)
    const closableRef = useRef(closable)

    useLayoutEffect(() => {
        onCloseRef.current = onClose
        closableRef.current = closable
    })

    useEffect(() => {
        if (!open) return undefined

        const previouslyFocused = document.activeElement
        const dialog = dialogRef.current
        const first = dialog.querySelector('[data-autofocus]') || dialog.querySelector(FOCUSABLE) || dialog
        first.focus()

        const { overflow } = document.body.style
        document.body.style.overflow = 'hidden'

        function onKeyDown(event) {
            if (event.key === 'Escape' && closableRef.current) {
                event.stopPropagation()
                onCloseRef.current()
                return
            }

            if (event.key === 'Tab') {
                const items = [...dialog.querySelectorAll(FOCUSABLE)]
                if (items.length === 0) return

                const firstItem = items[0]
                const lastItem = items[items.length - 1]

                if (event.shiftKey && document.activeElement === firstItem) {
                    event.preventDefault()
                    lastItem.focus()
                } else if (!event.shiftKey && document.activeElement === lastItem) {
                    event.preventDefault()
                    firstItem.focus()
                }
            }
        }

        document.addEventListener('keydown', onKeyDown)

        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = overflow
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
        }
    }, [open])

    if (!open) return null

    return createPortal(
        <div
            className="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && closable) onClose()
            }}
        >
            <div
                ref={dialogRef}
                className={`modal modal--${size}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="modal__header">
                    <h2 id={titleId} className="modal__title">
                        {title}
                    </h2>
                    {closable && (
                        <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть окно">
                            <CloseIcon />
                        </button>
                    )}
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>,
        document.body
    )
}
