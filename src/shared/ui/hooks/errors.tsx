import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useLayoutEffect, useState } from 'preact/hooks'

const Errors = createContext<{
  error: unknown
  report: (error: unknown) => void
} | null>(null)

export const PageErrors = ({ children }: { children: ComponentChildren }) => {
  const [error, setError] = useState<unknown>(null)
  const report = useCallback((failure: unknown) => setError(() => failure), [])

  return <Errors.Provider value={{ error, report }}>{children}</Errors.Provider>
}

export const usePageError = (error?: unknown) => {
  const context = useContext(Errors)
  const report = context?.report

  useLayoutEffect(() => {
    if (error) {
      report?.(error)
    }
  }, [report, error])
  return context?.error
}
