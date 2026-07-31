import 'notyf/notyf.min.css'

import browser from 'Background/browser-api'
import { ProxyMode } from 'Background/constants'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import { i18nGetMessage } from 'Background/utilities'
import { Notyf } from 'notyf'

(async () => {
  // How often the page asks the Amnezia client whether it's still up.
  // The background script does the same once a minute, this is only to
  // keep the open page in sync with the app without a noticeable delay.
  const LOCAL_PROXY_POLL_INTERVAL = 3000

  const notyf = new Notyf({
    duration: 2500,
    position: {
      x: 'center',
      y: 'bottom',
    },
    dismissible: true,
    ripple: false,
  })

  const proxyIsDown = document.getElementById('proxyIsDown')
  const proxyServerInput = document.getElementById('proxyServerInput')
  const saveCustomProxyButton = document.getElementById('saveCustomProxyButton')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const useCustomProxyRadioButton = document.getElementById('useCustomProxy')
  const useDefaultProxyRadioButton = document.getElementById('useDefaultProxy')
  const useLocalProxyRadioButton = document.getElementById('useLocalProxy')
  const proxyCustomOptionsRadioGroup = document.getElementById('proxyCustomOptionsRadioGroup')
  const selectProxyProtocol = document.querySelector('.select')
  const currentProxyProtocol = document.querySelector('#select-toggle')
  const proxyProtocols = document.querySelectorAll('.select-option')
  const localProxyOptions = document.getElementById('localProxyOptions')
  const moreAboutAmneziaPremiumLink = document.getElementById('moreAboutAmneziaPremiumLink')
  const whereToFindAddressLink = document.getElementById('whereToFindAddressLink')

  const radioButtons = {
    [ProxyMode.DEFAULT]: useDefaultProxyRadioButton,
    [ProxyMode.CUSTOM]: useCustomProxyRadioButton,
    [ProxyMode.LOCAL]: useLocalProxyRadioButton,
  }

  // Whether the extension is currently proxying through the Amnezia
  // local proxy. Used to show the success message on connect only.
  let localProxyConnected = false
  let localProxyPollTimeoutId = null
  // Opening the page is not a connection event, so the state it starts
  // with is the baseline and never produces a success message.
  let initialized = false
  let pendingRefresh = Promise.resolve()

  const readState = async () => {
    const [mode, enabled, defaultProxyAlive] = await Promise.all([
      ProxyManager.getMode(),
      ProxyManager.isEnabled(),
      ProxyManager.alive(),
    ])
    const { localProxyAlive } =
      await browser.storage.local.get({ localProxyAlive: false })

    return { mode, enabled, defaultProxyAlive, localProxyAlive }
  }

  const render = ({ mode, enabled, defaultProxyAlive, localProxyAlive }) => {
    const radioButton = radioButtons[mode]

    if (radioButton) {
      radioButton.checked = true
    }

    useProxyCheckbox.checked = enabled
    proxyCustomOptions.hidden = !enabled

    // The warning about the failing proxy server is only about ours.
    proxyIsDown.hidden = !(
      enabled && mode === ProxyMode.DEFAULT && !defaultProxyAlive
    )

    proxyOptionsInputs.classList.toggle('hidden', mode !== ProxyMode.CUSTOM)
    localProxyOptions.classList.toggle(
      'hidden',
      !(enabled && mode === ProxyMode.LOCAL && !localProxyAlive),
    )
  }

  const applyState = async () => {
    const state = await readState()

    render(state)

    const connected = (
      state.enabled &&
      state.mode === ProxyMode.LOCAL &&
      state.localProxyAlive
    )

    if (initialized && connected && !localProxyConnected) {
      notyf.success(i18nGetMessage('successLocalProxySet'))
    }

    localProxyConnected = connected
  }

  /**
   * Renders the current state and notifies the user once the connection
   * to the Amnezia local proxy is established, no matter what caused it:
   * the checkbox, the radio button or «Local system proxy» in AmneziaVPN.
   * Calls are queued, otherwise two changes arriving at once could both
   * observe the same «not connected yet» state and notify twice.
   */
  const refresh = () => {
    pendingRefresh = pendingRefresh
      .then(applyState)
      .catch((error) => {
        console.error(`Failed to render proxy options: ${error}`)
      })

    return pendingRefresh
  }

  const pollLocalProxy = () => {
    if (localProxyPollTimeoutId !== null) {
      clearTimeout(localProxyPollTimeoutId)
      localProxyPollTimeoutId = null
    }

    // Nothing to poll for while the page is in the background.
    if (document.visibilityState !== 'visible') {
      return
    }

    localProxyPollTimeoutId = setTimeout(async () => {
      localProxyPollTimeoutId = null
      // Returns immediately unless the local proxy is the current mode.
      // Changes are picked up by the storage listener below.
      await ProxyManager.syncLocalProxy()
      pollLocalProxy()
    }, LOCAL_PROXY_POLL_INTERVAL)
  }

  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName && areaName !== 'local') {
      return
    }

    const changed = [
      'proxyMode',
      'useProxy',
      'localProxyAlive',
      'proxyIsAlive',
    ].some((key) => key in changes)

    if (changed) {
      await refresh()
    }
  })

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await refresh()
    }
    pollLocalProxy()
  })

  moreAboutAmneziaPremiumLink.addEventListener('click', (e) => {
    e.preventDefault()
    window.open(i18nGetMessage('moreAboutAmneziaPremium'), '_blank')
  })

  whereToFindAddressLink.addEventListener('click', (e) => {
    e.preventDefault()
    window.open(i18nGetMessage('whereToFindAddressLink'), '_blank')
  })

  const { customProxyProtocol, customProxyServerURI } =
    await browser.storage.local.get([
      'customProxyProtocol',
      'customProxyServerURI',
    ])

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (customProxyServerURI) {
    proxyServerInput.value = customProxyServerURI
  }

  saveCustomProxyButton.addEventListener('click', async (event) => {
    const customProxyServer = proxyServerInput.value
    const proxyProtocol = currentProxyProtocol.textContent.trim()

    if (!customProxyServer) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyAddressEmpty'))
      return
    }

    // Validate port number
    // Format: hostname:port
    const parts = customProxyServer.split(':')
    const portString = parts[parts.length - 1]

    if (!portString || parts.length < 2) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyPortMissing'))
      return
    }

    const port = parseInt(portString, 10)

    if (isNaN(port) || port < 1 || port > 65535) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyPortInvalid', { port: portString }))
      return
    }

    await ProxyManager.setMode(ProxyMode.CUSTOM)
    await browser.storage.local.set({
      customProxyProtocol: proxyProtocol,
      customProxyServerURI: customProxyServer,
    })

    await ProxyManager.setProxy()
    proxyServerInput.classList.remove('invalid-input')

    notyf.success(i18nGetMessage('successProxySaved', {
      protocol: proxyProtocol,
      server: customProxyServer,
    }))

    console.log(`Proxy host changed to: ${customProxyServer}`)
    await refresh()
  })

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    const mode = event.target.value
    const previousMode = await ProxyManager.getMode()

    // The mode is stored before anything else: a local proxy check which
    // is already in flight re-reads it before writing and bails out, so
    // it can no longer overwrite the mode the user has just chosen.
    await ProxyManager.setMode(mode)
    // Everything below may take seconds, the UI shouldn't wait for it.
    await refresh()

    if (previousMode === ProxyMode.LOCAL && mode !== ProxyMode.LOCAL) {
      await ProxyClient.stop()
    }

    if (mode === ProxyMode.DEFAULT) {
      await server.synchronize({ syncRegistry: true, syncProxy: true })
      await ProxyManager.setProxy()
      notyf.success(i18nGetMessage('successDefaultProxySet'))
    } else if (mode === ProxyMode.CUSTOM) {
      await ProxyManager.setProxy()
    } else if (mode === ProxyMode.LOCAL) {
      await ProxyManager.syncLocalProxy({ startIfMissing: true })
    }

    await refresh()
  })

  ProxyManager.controlledByOtherExtensions()
    .then(async (controlledByOtherExtensions) => {
      if (controlledByOtherExtensions) {
        useProxyCheckbox.checked = false
        useProxyCheckbox.disabled = true
        await ProxyManager.disableProxy()
      }
    })

  useProxyCheckbox.addEventListener('change', async () => {
    if (!useProxyCheckbox.checked) {
      await ProxyManager.disableProxy()
      await refresh()
      return
    }

    await ProxyManager.enableProxy()
    await refresh()

    if (await ProxyManager.getMode() === ProxyMode.LOCAL) {
      await ProxyManager.syncLocalProxy({ startIfMissing: true })
      await refresh()
    }
  }, false)

  document.addEventListener('click', (event) => {
    if (event.target.id === 'select-toggle') {
      selectProxyProtocol.classList.toggle('show-protocols')
    }

    if (!event.target.closest('.select')) {
      for (const element of document.querySelectorAll('.show-protocols')) {
        element.classList.remove('show-protocols')
      }
    }
  })

  for (const option of proxyProtocols) {
    option.addEventListener('click', async (event) => {
      selectProxyProtocol.classList.remove('show-protocols')

      currentProxyProtocol.value = event.target.dataset.value
      currentProxyProtocol.textContent = event.target.dataset.value
    })
  }

  await refresh()
  // Whatever is stored may be outdated, so the local proxy is checked
  // once before the state of the page is taken as the baseline.
  await ProxyManager.syncLocalProxy()
  await refresh()
  initialized = true
  pollLocalProxy()
})()
