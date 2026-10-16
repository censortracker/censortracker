import { useLayoutEffect } from 'preact/hooks'

import { useLatest } from './async'

// Close an open dialog with Escape.
export const useEscape = (open: boolean, onClose: () => void) => {
  const close = useLatest(onClose)

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close.current()
      }
    }

    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, close])
}
