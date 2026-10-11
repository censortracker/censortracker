import browser from 'Background/browser-api'
import type { StorageChanges } from 'Background/storage'
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks'

// Read the latest callback without restarting listeners or timers.
export const useLatest = <T>(value: T) => {
  const ref = useRef(value)

  ref.current = value
  return ref
}

export const useAction = () => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const running = useRef(false)
  const alive = useRef(true)

  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (running.current || !alive.current) {
      return
    }
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (error_) {
      if (alive.current) {
        setError(error_)
      }
    } finally {
      running.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }, [])

  return { busy, error, run }
}

export const useStorageChanges = (
  changed: (changes: StorageChanges) => void,
) => {
  const callback = useLatest(changed)

  useLayoutEffect(() => {
    const listener = (changes: StorageChanges, area: string) => {
      if (area === 'local') {
        callback.current(changes)
      }
    }

    browser.storage.onChanged.addListener(listener)
    return () => browser.storage.onChanged.removeListener(listener)
  }, [])
}

export const useResource = <T>(read: () => Promise<T>, keys: string[] = []) => {
  const callback = useLatest(read)
  const [value, setValue] = useState<T>()
  const [error, setError] = useState<unknown>(null)
  const revision = useRef(0)
  const active = useRef(true)
  const invalidate = useCallback(() => {
    revision.current++
  }, [])
  const refresh = useCallback(async () => {
    if (!active.current) {
      return undefined
    }
    const request = ++revision.current

    try {
      const result = await callback.current()

      if (request === revision.current) {
        setValue(result)
        setError(null)
      }
      return result
    } catch (error_) {
      if (request === revision.current) {
        setError(error_)
      }
      return undefined
    }
  }, [])

  useLayoutEffect(() => {
    active.current = true
    refresh()
    return () => {
      active.current = false
      revision.current++
    }
  }, [])
  useStorageChanges((changes) => {
    if (keys.some((key) => key in changes)) {
      refresh()
    }
  })
  return { value, error, refresh, invalidate }
}

export const useVisiblePolling = (
  refresh: () => Promise<unknown>, ms: number,
) => {
  const callback = useLatest(refresh)

  useLayoutEffect(() => {
    let active = true
    let running = false
    let timer: number | undefined
    const schedule = () => {
      clearTimeout(timer)
      if (active && !running && document.visibilityState === 'visible') {
        timer = window.setTimeout(poll, ms)
      }
    }
    const poll = async () => {
      if (!active || document.visibilityState !== 'visible') {
        return
      }
      running = true
      try {
        await callback.current()
      } finally {
        running = false
        schedule()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', schedule)
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [ms])
}
