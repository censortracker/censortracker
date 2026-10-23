import { getMessage } from 'Background/i18n'
import { useLayoutEffect, useState } from 'preact/hooks'

import { usePageError } from '../hooks/errors'

export const PageError = ({ error }: { error?: unknown }) => {
  const [unhandled, setUnhandled] = useState<unknown>(null)

  useLayoutEffect(() => {
    const listener = (event: PromiseRejectionEvent) => {
      setUnhandled(event.reason)
    }

    window.addEventListener('unhandledrejection', listener)
    return () => window.removeEventListener('unhandledrejection', listener)
  }, [])
  const reported = usePageError()
  const failure = error || unhandled || reported

  return failure ? <p id="pageError" role="alert">
    {getMessage('operationFailed') +
      (failure instanceof Error ? ` ${failure.message}` : '')}
  </p> : null
}
