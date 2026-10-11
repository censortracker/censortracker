import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'
import Settings from 'Background/settings'
import { useLayoutEffect, useState } from 'preact/hooks'

import { useAction, useLatest, useResource } from '../hooks/async'
import settings from '../styles/options.module.scss'
import popup from '../styles/popup.module.scss'
import notice from './notice.module.scss'

export const usePrivateBrowsing = (onSuccess?: () => void) => {
  const { busy, error, run } = useAction()
  const active = useLatest(busy)
  const [status, setStatus] = useState('')
  const [restoreError, setRestoreError] = useState<unknown>(null)
  const apply = async () => {
    if (!await ProxyManager.setProxy()) {
      const { proxySetupError = '' } =
        await browser.storage.local.get('proxySetupError')

      throw new Error(`${getMessage('proxySetupFailed')} ${proxySetupError}`.trim())
    }
  }
  const { value: allowed, error: readError, refresh } =
    useResource(async () => {
      if (!browser.isFirefox) {
        return true
      }
      const { privateBrowsingPermissionsRequired } =
        await browser.storage.local.get({
          privateBrowsingPermissionsRequired: false,
        })
      const permission = await ProxyManager.requestIncognitoAccess()

      if (!active.current && permission && privateBrowsingPermissionsRequired &&
      await Settings.extensionEnabled() && await ProxyManager.isEnabled()) {
        await apply().catch(setRestoreError)
      }
      return permission
    })

  useLayoutEffect(() => {
    const focus = () => {
      refresh()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  const confirm = () => run(async () => {
    setRestoreError(null)
    setStatus(getMessage('proxySetupRunning'))
    if (!await ProxyManager.requestIncognitoAccess()) {
      throw new Error(getMessage('privateBrowsingStillRequired'))
    }
    if (!await Settings.extensionEnabled()) {
      throw new Error(getMessage('proxySetupExtensionDisabled'))
    }
    await ProxyManager.enableProxy()
    await apply()
    await refresh()
    setStatus(getMessage('proxySetupDone'))
    onSuccess?.()
  })
  const failure = error || readError || restoreError

  return { allowed, busy, failure, status, confirm }
}

export const PrivateBrowsing = ({ onSuccess, compact = false }: {
  onSuccess?: () => void
  compact?: boolean
}) => {
  const { allowed, busy, failure, status, confirm } =
    usePrivateBrowsing(onSuccess)
  const styles = compact ? popup : settings
  const messageStyles = compact ? popup : notice

  return <>
    <div class={messageStyles['main-page__extension']}
      id="privateBrowsingPermissionsRequiredMessage" hidden={allowed !== false}>
      <div class={messageStyles.extension__title}>{getMessage('privateBrowsingRequired')}</div>
      <div class={styles.extension__text}>{getMessage('privateBrowsingRequiredDesc')}</div>
      <a id="howToGrantIncognitoAccess" class={messageStyles['default-btn']}
        onClick={() => browser.tabs.create({
          url: getMessage('howToGrantIncognitoAccessLink'),
        })}>{getMessage('howToGrantIncognitoAccess')}</a>
    </div>
    {browser.isFirefox && <p hidden={!status && !failure}
      role={failure ? 'alert' : 'status'}>
      {failure instanceof Error ? failure.message : status}
    </p>}
    <button type="button" class={messageStyles['default-btn']}
      hidden={allowed !== false} disabled={busy}
      id="grantPrivateBrowsingPermissionsButton" onClick={confirm}>
      {getMessage('grantPrivateBrowsingPermissions')}
    </button>
  </>
}
