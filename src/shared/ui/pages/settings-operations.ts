import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import Settings from 'Background/settings'

export const updateRegistry = async () => {
  await server.synchronize()
  const { serviceErrors = [] } = await browser.storage.local.get('serviceErrors')

  if (await ProxyManager.isEnabled()) {
    await ProxyManager.removeBadProxies()
    if (!await ProxyManager.setProxy()) {
      throw new Error(getMessage('proxySetupFailed'))
    }
    await ProxyManager.ping()
  }
  if (serviceErrors.length > 0) {
    throw new Error(serviceErrors.join('; '))
  }
}

export const resetSettings = async () => {
  await Settings.importSettings({ enableExtension: true })
  await ProxyManager.removeBadProxies()
  await server.synchronize()
  const canSetProxy = await ProxyManager.requestIncognitoAccess()

  if (canSetProxy && !await ProxyManager.setProxy()) {
    throw new Error(getMessage('proxySetupFailed'))
  }
  const { serviceErrors = [] } = await browser.storage.local.get('serviceErrors')

  if (serviceErrors.length > 0) {
    throw new Error(serviceErrors.join('; '))
  }
  if (canSetProxy) {
    await ProxyManager.ping()
  }
}

export const importSettings = async (file?: File) => {
  if (!file) {
    return
  }
  if (file.size > 32 * 1024 * 1024) {
    throw new Error('Settings file is too large')
  }
  await Settings.importSettings(JSON.parse(await file.text()))
  await ProxyManager.setProxy()
  await server.synchronize({ syncRegistry: true })
  await ProxyManager.setProxy()
  window.location.reload()
}

export const exportFile = async (diagnostics: boolean) => {
  const data = diagnostics ? await callBackground('diagnosticInfo')
    : await Settings.exportSettings()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  try {
    link.href = url
    link.download = `censortracker.${diagnostics ? 'diagnostics' : 'settings'}.json`
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
