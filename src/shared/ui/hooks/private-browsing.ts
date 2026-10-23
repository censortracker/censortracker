import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useLayoutEffect, useState } from 'preact/hooks'

import { detach, useAction, useLatest, useResource } from './async'

export const openIncognitoHelp = () => browser.tabs.create({
  url: getMessage('howToGrantIncognitoAccessLink'),
})

export const usePrivateBrowsing = (onSuccess?: () => unknown) => {
  const { busy, error, run } = useAction()
  const active = useLatest(busy)
  const [status, setStatus] = useState('')
  const [restoreError, setRestoreError] = useState<unknown>(null)
  const { value: allowed, error: readError, refresh } =
    useResource(async () => {
      if (!browser.isFirefox) {
        return true
      }
      const access = await callBackground('incognitoAccess')

      if (!active.current && access.restore) {
        await callBackground('applyProxy', false).catch(setRestoreError)
      }
      return access.allowed
    })

  useLayoutEffect(() => {
    const focus = () => {
      detach(refresh())
    }
    const visible = () => {
      if (document.visibilityState === 'visible') {
        detach(refresh())
      }
    }

    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh])
  const confirm = () => run(async () => {
    setRestoreError(null)
    setStatus(getMessage('proxySetupRunning'))
    if (!(await callBackground('incognitoAccess')).allowed) {
      throw new Error(getMessage('privateBrowsingStillRequired'))
    }
    await callBackground('applyProxy', true)
    await refresh()
    setStatus(getMessage('proxySetupDone'))
    onSuccess?.()
  })
  const failure = error || readError || restoreError

  return { allowed, busy, failure, status, confirm }
}
