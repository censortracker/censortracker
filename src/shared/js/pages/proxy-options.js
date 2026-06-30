import browser from 'Background/browser-api'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import ProxyChecker from 'Background/proxychecker'
import * as server from 'Background/server'
import {
  fetchProxyList,
  getSubscriptionById,
  SUBSCRIPTIONS,
} from 'Background/subscriptions'
import { i18nGetMessage, parseProxyString } from 'Background/utilities'

(async () => {
  const proxyingEnabled = await ProxyManager.isEnabled()
  const loading = document.getElementById('loading')
  const proxyIsDown = document.getElementById('proxyIsDown')
  const rksVPNBanner = document.getElementById('rksVPNBanner')
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
  const addLocalProxyButton = document.getElementById('addLocalProxyButton')
  const addLocalProxyPopup = document.getElementById('addLocalProxyPopup')
  const closeLocalProxyPopupButton = document.getElementById('closeLocalProxyPopup')
  const goBackLocalProxy = document.getElementById('goBackLocalProxy')
  const addLocalProxyConfigButton = document.getElementById('addLocalProxyConfigButton')
  const localProxyClientNotFound = document.getElementById('localProxyClientNotFound')
  const changeLocalProxyRadio = document.getElementById('changeLocalProxyRadio')
  const invalidLocalProxyConfig = document.getElementById('invalidLocalProxyConfig')
  const localProxyTextarea = document.getElementById('localProxyTextarea')
  const downloadLocalProxyButton = document.getElementById('downloadLocalProxyButton')
  const proxyNameInput = document.getElementById('proxyNameInput')
  const customProxyList = document.getElementById('customProxyList')
  const invalidCustomProxy = document.getElementById('invalidCustomProxy')
  const currentProxyAddress = document.getElementById('currentProxyAddress')
  const currentProxyAddressValue = document.getElementById('currentProxyAddressValue')
  const customProxyFormTitle = document.getElementById('customProxyFormTitle')
  const cancelEditProxyButton = document.getElementById('cancelEditProxyButton')

  // Import / subscriptions.
  const importToggle = document.getElementById('importToggle')
  const importBody = document.getElementById('importBody')
  const subscriptionSelect = document.getElementById('subscriptionSelect')
  const loadSubscriptionButton = document.getElementById('loadSubscriptionButton')
  const proxyListUrlInput = document.getElementById('proxyListUrlInput')
  const loadProxyListUrlButton = document.getElementById('loadProxyListUrlButton')
  const loadViaActiveProxy = document.getElementById('loadViaActiveProxy')
  const importLimitInput = document.getElementById('importLimitInput')
  const importStatus = document.getElementById('importStatus')

  // Proxy list + checker.
  const listToggle = document.getElementById('listToggle')
  const listBody = document.getElementById('listBody')
  const proxyCount = document.getElementById('proxyCount')
  const checkAllButton = document.getElementById('checkAllButton')
  const stopCheckButton = document.getElementById('stopCheckButton')
  const removeDeadButton = document.getElementById('removeDeadButton')
  const autoRemoveDead = document.getElementById('autoRemoveDead')
  const checkProgress = document.getElementById('checkProgress')
  const checkProgressFill = document.getElementById('checkProgressFill')
  const checkProgressText = document.getElementById('checkProgressText')

  // Holds the AbortController of an in-flight check (null when idle).
  let checkController = null

  if (proxyNameInput) {
    proxyNameInput.placeholder = i18nGetMessage('customProxyNamePlaceholder')
  }

  ProxyManager.isEnabled().then((isEnabled) => {
    useProxyCheckbox.checked = isEnabled
  })

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const closeLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'none'
  }

  closeLocalProxyPopupButton.addEventListener('click', () => {
    closeLocalProxyPopup()
  })

  goBackLocalProxy.addEventListener('click', () => {
    closeLocalProxyPopup()
  })

  addLocalProxyButton.addEventListener('click', () => {
    invalidLocalProxyConfig.classList.add('hidden')
    addLocalProxyPopup.style.display = 'block'
    localProxyTextarea.value = ''
  })

  downloadLocalProxyButton.addEventListener('click', () => {
    window.open('https://github.com/censortracker/proxy/releases', '_blank')
  })

  // Handle deleting local proxy configs.
  changeLocalProxyRadio.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.delete-config')

    if (!deleteButton) {
      return
    }

    const configId = deleteButton.dataset.id
    const proxyBlock = document.getElementById(`proxyconf-${configId}`)

    if (proxyBlock) {
      proxyBlock.classList.add('hidden')
    }

    try {
      const { status, message } = await ProxyClient.deleteConfig(configId, 250)

      if (status === 'success') {
        console.warn(`Config ${configId} has been deleted`)

        if (proxyBlock) {
          proxyBlock.remove()
          const remainingConfigs = changeLocalProxyRadio.querySelectorAll('.delete-config')

          if (remainingConfigs.length === 0) {
            rksVPNBanner.classList.remove('hidden')
            await ProxyManager.removeLocalProxy()
            await ProxyManager.setProxy()
          }
        }
      } else {
        console.error(`Failed to delete config: ${configId}: ${message}`)
        if (proxyBlock) {
          proxyBlock.classList.remove('hidden')
        }
      }
    } catch (error) {
      if (proxyBlock) {
        proxyBlock.classList.remove('hidden')
        console.error(`Error deleting config: ${configId}`, error)
      }
    }
  })

  const renderLocalProxyConfigs = async () => {
    const { configs = {} } = await ProxyClient.getConfig('', 350)

    if (Object.keys(configs).length === 0) {
      if (await ProxyManager.isEnabled()) {
        await ProxyManager.removeLocalProxy()
        await ProxyManager.setProxy()
        return
      }
    }

    if (changeLocalProxyRadio.innerHTML) {
      changeLocalProxyRadio.innerHTML = ''
    }

    loading.style.display = 'flex'

    for (const [id, { name, isActive }] of Object.entries(configs)) {
      const div = document.createElement('div')

      if (isActive) {
        await browser.storage.local.set({
          useLocalProxy: true,
          activeProxyConfigName: name,
        })
      }
      div.id = `proxyconf-${id}`
      div.className = 'proxy-list__block'
      div.innerHTML = `
       <div class="radio-button proxy-list__block-item">
        <input class="radio-button-input" type="radio" name="local-proxy" id="${id}" value="${id}"
          ${isActive ? 'checked' : ''} data-config-name="${name}"/>
        <label class="radio-button-label" for="${id}">${name}</label>
        <div class="proxy-list__block-item__btn delete-config" data-id="${id}">
          <svg class="close-icon" width="24" height="24" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-opacity="0.8" stroke-width="2"/>
          </svg>
        </div>
       </div>`
      changeLocalProxyRadio.append(div)
    }
    loading.style.display = 'none'

    if (await ProxyManager.isEnabled()) {
      await ProxyClient.setLocalProxyURI()
      await ProxyManager.setProxy()
    }
  }

  const showLocalProxySettings = async () => {
    const pingData = await ProxyClient.ping(500)

    if (Object.keys(pingData).length === 0) {
      addLocalProxyButton.style.display = 'none'
      localProxyOptions.style.display = 'block'
      localProxyClientNotFound.classList.remove('hidden')
    } else {
      localProxyOptions.style.display = 'block'
      addLocalProxyButton.style.display = 'inline-flex'

      if (!pingData.xray_running) {
        const { status, message } = await ProxyClient.start(1000)

        if (status === 'success') {
          console.log(message)
        } else {
          console.error(message)
        }
      }

      if (pingData && pingData.config_count === 0) {
        rksVPNBanner.classList.remove('hidden')
      }
    }
  }

  // Applying newly added local proxy config.
  addLocalProxyConfigButton.addEventListener('click', async () => {
    const value = localProxyTextarea.value.trim()
    const configs = await ProxyClient.parseConfig(value)

    if (configs.length > 0) {
      const data = await ProxyClient.setConfig({ configs })

      if (data && data.status === 'success') {
        rksVPNBanner.classList.add('hidden')
        await renderLocalProxyConfigs()
        closeLocalProxyPopup()
        return
      }
      console.error(data.message)
    }

    invalidLocalProxyConfig.classList.remove('hidden')
    setTimeout(() => {
      invalidLocalProxyConfig.classList.add('hidden')
    }, 7000)
  })

  // Switching between local proxy configs.
  changeLocalProxyRadio.addEventListener('change', async (event) => {
    const activeProxyConfigId = event.target.value.trim()
    const activeProxyConfigName = event.target.dataset.configName.trim()

    const { status, message } = await ProxyClient.activateConfig(
      activeProxyConfigId, 500,
    )

    if (status === 'success') {
      console.log(`Config ${activeProxyConfigId} has been activated`)
      await browser.storage.local.set({
        useLocalProxy: true,
        activeProxyConfigId,
        activeProxyConfigName,
      })
      await ProxyClient.setLocalProxyURI()
      await ProxyManager.setProxy()
    } else {
      console.error(message)
    }
  })

  // Holds the id of the user proxy currently being edited (null when adding).
  let editingProxyId = null

  const escapeHtml = (value) => {
    return String(value).replace(/[&<>"']/g, (char) => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
      }[char]
    })
  }

  // Human-readable label for a connectivity status (+ latency when alive).
  const statusLabel = (status = '', latency = null) => {
    if (status === 'alive') {
      return latency
        ? `${latency} ${i18nGetMessage('latencyMsSuffix')}`
        : i18nGetMessage('proxyStatusAlive')
    }
    if (status === 'dead') {
      return i18nGetMessage('proxyStatusDead')
    }
    if (status === 'checking') {
      return i18nGetMessage('proxyStatusChecking')
    }
    return ''
  }

  // Builds the connectivity-status pill shown on each user proxy row.
  const statusBadgeHtml = (status = '', latency = null) => {
    return `<span class="cproxy-status" data-status="${escapeHtml(status)}">
        <span class="cproxy-status__dot"></span>
        <span class="cproxy-status__label">${escapeHtml(statusLabel(status, latency))}</span>
      </span>`
  }

  // Updates one row's status pill in place (used for live check results).
  const setRowStatus = (id, status, latency = null) => {
    const row = customProxyList.querySelector(`.cproxy-row[data-id="${CSS.escape(id)}"]`)

    if (!row) {
      return
    }

    const badge = row.querySelector('.cproxy-status')

    if (!badge) {
      return
    }

    badge.setAttribute('data-status', status)
    const label = badge.querySelector('.cproxy-status__label')

    if (label) {
      label.textContent = statusLabel(status, latency)
    }
  }

  const removeRowFromDom = (id) => {
    const row = customProxyList.querySelector(`.cproxy-row[data-id="${CSS.escape(id)}"]`)

    if (row) {
      row.remove()
    }
  }

  // Renders one row (built-in or user) in the unified proxy list.
  const renderProxyRow = (
    { id, name, protocol, uri, builtin = false, lastStatus = '', latency = null },
    activeId,
  ) => {
    const editTitle = i18nGetMessage(builtin ? 'editBuiltinProxyButton' : 'editProxyButton')
    const badge = builtin
      ? `<span class="cproxy-badge">${escapeHtml(i18nGetMessage('builtinProxyBadge'))}</span>`
      : statusBadgeHtml(lastStatus, latency)
    const deleteBtn = builtin
      ? ''
      : `<button type="button" class="cproxy-icon-btn cproxy-del" data-id="${id}"
            title="${escapeHtml(i18nGetMessage('deleteProxyButton'))}">
          <svg width="20" height="20" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-width="3"/>
          </svg>
        </button>`

    return `
     <div class="cproxy-row" data-id="${id}">
       <label class="cproxy-row__main">
         <input type="radio" name="custom-proxy" value="${id}" ${id === activeId ? 'checked' : ''}/>
         <span class="cproxy-row__text">
           <span class="cproxy-row__name">${escapeHtml(name)}</span>
           <span class="cproxy-row__addr">${escapeHtml(protocol)} ${escapeHtml(uri)}</span>
         </span>
         ${badge}
       </label>
       <div class="cproxy-row__actions">
         <button type="button" class="cproxy-icon-btn cproxy-edit"
                 data-id="${id}" data-builtin="${builtin}" title="${escapeHtml(editTitle)}">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17.17V20z"
                   stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
           </svg>
         </button>
         ${deleteBtn}
       </div>
     </div>`
  }

  // Render the unified list: the built-in (backend) proxy first, then the
  // user-defined ones.
  const renderCustomProxies = async () => {
    if (!customProxyList) {
      return
    }

    const proxies = await ProxyManager.getCustomProxies()
    const builtin = await ProxyManager.getBuiltinProxy()
    const activeId = await ProxyManager.getActiveCustomProxyId()

    let html = ''

    if (builtin) {
      html += renderProxyRow({
        id: 'builtin',
        name: i18nGetMessage('builtinProxyName'),
        protocol: builtin.protocol,
        uri: builtin.uri,
        builtin: true,
      }, activeId)
    }

    for (const proxy of proxies) {
      html += renderProxyRow(proxy, activeId)
    }

    customProxyList.innerHTML = html
    updateListMeta(proxies.length)
    await refreshCurrentProxyAddress()
  }

  // Keeps the "N proxies" counter and the toolbar buttons in sync with the
  // current list size (without re-querying storage).
  const updateListMeta = (count) => {
    if (proxyCount) {
      proxyCount.textContent = count > 0 ? `${count} ${i18nGetMessage('proxiesCountSuffix')}` : ''
    }
    if (removeDeadButton) {
      removeDeadButton.disabled = count === 0
    }
    if (checkAllButton) {
      checkAllButton.disabled = count === 0
    }
  }

  // Shows the address of the proxy that is effectively in use right now.
  async function refreshCurrentProxyAddress () {
    if (!currentProxyAddress) {
      return
    }

    const { localProxyURI } = await browser.storage.local.get({ localProxyURI: '' })

    if (localProxyURI) {
      currentProxyAddress.hidden = true
      return
    }

    const { proxyServerProtocol, proxyServerURI } =
      await ProxyManager.getProxyingRules()

    if (proxyServerURI) {
      currentProxyAddressValue.textContent = `${proxyServerProtocol} ${proxyServerURI}`
      currentProxyAddress.hidden = false
    } else {
      currentProxyAddress.hidden = true
    }
  }

  const resetProxyForm = () => {
    editingProxyId = null
    proxyServerInput.value = ''
    if (proxyNameInput) {
      proxyNameInput.value = ''
    }
    proxyServerInput.classList.remove('invalid-input')
    saveCustomProxyButton.querySelector('.btn__text').textContent =
      i18nGetMessage('addCustomProxyButton')
    if (customProxyFormTitle) {
      customProxyFormTitle.textContent = i18nGetMessage('addCustomProxyTitle')
    }
    if (cancelEditProxyButton) {
      cancelEditProxyButton.classList.add('hidden')
    }
  }

  // Loads a proxy into the form. Built-in proxies are loaded as a *copy*
  // (editingProxyId stays null) so saving creates a new editable entry.
  const loadProxyIntoForm = ({ id, name, protocol, uri, builtin }) => {
    editingProxyId = builtin ? null : id
    if (proxyNameInput) {
      proxyNameInput.value = builtin ? i18nGetMessage('builtinProxyName') : name
    }
    proxyServerInput.value = uri
    currentProxyProtocol.textContent = protocol
    currentProxyProtocol.value = protocol

    saveCustomProxyButton.querySelector('.btn__text').textContent =
      i18nGetMessage(builtin ? 'addCustomProxyButton' : 'saveProxyButton')
    if (customProxyFormTitle) {
      customProxyFormTitle.textContent =
        i18nGetMessage(builtin ? 'addCustomProxyTitle' : 'editCustomProxyTitle')
    }
    if (cancelEditProxyButton) {
      cancelEditProxyButton.classList.toggle('hidden', builtin)
    }
    proxyServerInput.focus()
  }

  // Select an active proxy from the list (built-in or user).
  customProxyList.addEventListener('change', async (event) => {
    if (event.target.name !== 'custom-proxy') {
      return
    }

    // Switching proxies mid-check would clobber the temporary checker PAC.
    if (checkController) {
      event.target.checked = false
      return
    }

    const value = event.target.value
    const activated = value === 'builtin'
      ? await ProxyManager.setActiveBuiltinProxy()
      : await ProxyManager.setActiveCustomProxy(value)

    if (activated) {
      await ProxyManager.setProxy()
      await refreshCurrentProxyAddress()
      console.log(`Active proxy changed to ${value}`)
    }
  })

  // Handle edit / delete actions on rows.
  customProxyList.addEventListener('click', async (event) => {
    // Don't mutate the list while a check is walking through it.
    if (checkController) {
      return
    }

    const editButton = event.target.closest('.cproxy-edit')

    if (editButton) {
      const id = editButton.dataset.id
      const builtin = editButton.dataset.builtin === 'true'

      if (builtin) {
        const proxy = await ProxyManager.getBuiltinProxy()

        if (proxy) {
          loadProxyIntoForm({ ...proxy, builtin: true })
        }
      } else {
        const proxies = await ProxyManager.getCustomProxies()
        const proxy = proxies.find((item) => item.id === id)

        if (proxy) {
          loadProxyIntoForm({ ...proxy, builtin: false })
        }
      }
      return
    }

    const deleteButton = event.target.closest('.cproxy-del')

    if (deleteButton) {
      if (editingProxyId === deleteButton.dataset.id) {
        resetProxyForm()
      }
      await ProxyManager.deleteCustomProxy(deleteButton.dataset.id)
      await ProxyManager.setProxy()
      await renderCustomProxies()
    }
  })

  const {
    useOwnProxy,
    useLocalProxy,
    customProxyProtocol,
  } = await browser.storage.local.get([
    'useOwnProxy',
    'useLocalProxy',
    'customProxyProtocol',
  ])

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (useLocalProxy) {
    useLocalProxyRadioButton.checked = true
    await showLocalProxySettings()
    await renderLocalProxyConfigs()
  } else if (useOwnProxy) {
    proxyOptionsInputs.hidden = false
    useCustomProxyRadioButton.checked = true
    proxyOptionsInputs.classList.remove('hidden')
    await renderCustomProxies()
  } else {
    proxyOptionsInputs.classList.add('hidden')
    useDefaultProxyRadioButton.checked = true
  }

  // Always show the address of the proxy currently in use.
  await refreshCurrentProxyAddress()

  const flashInvalidCustomProxy = () => {
    proxyServerInput.classList.add('invalid-input')
    if (invalidCustomProxy) {
      invalidCustomProxy.classList.remove('hidden')
      setTimeout(() => invalidCustomProxy.classList.add('hidden'), 6000)
    }
  }

  if (cancelEditProxyButton) {
    cancelEditProxyButton.addEventListener('click', resetProxyForm)
  }

  // Add a new proxy, or save changes to the one being edited.
  saveCustomProxyButton.addEventListener('click', async (event) => {
    const rawValue = proxyServerInput.value.trim()
    const selectedProtocol = currentProxyProtocol.textContent.trim()

    // Accept any common format: "host:port", "socks5://user:pass@host:port",
    // "https://host:port", etc. A scheme in the string overrides the picker.
    const parsed = parseProxyString(rawValue, selectedProtocol)

    if (!parsed) {
      flashInvalidCustomProxy()
      return
    }

    const name = proxyNameInput ? proxyNameInput.value.trim() : ''

    if (editingProxyId) {
      await ProxyManager.updateCustomProxy(editingProxyId, {
        name,
        protocol: parsed.protocol,
        uri: parsed.uri,
      })
      console.log(`Custom proxy updated: ${parsed.protocol} ${parsed.uri}`)
    } else {
      await ProxyManager.addCustomProxy({
        name,
        protocol: parsed.protocol,
        uri: parsed.uri,
      })
      console.log(`Custom proxy added: ${parsed.protocol} ${parsed.uri}`)
    }

    await ProxyManager.setProxy()
    resetProxyForm()
    await renderCustomProxies()
  })

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    const value = event.target.value

    if (value === 'default') {
      proxyOptionsInputs.classList.add('hidden')
      resetProxyForm()
      localProxyOptions.style.display = 'none'
      addLocalProxyButton.style.display = 'none'
      await server.synchronize({
        syncRegistry: true,
        syncProxy: true,
      })
      await ProxyManager.removeCustomProxy()
      await ProxyManager.removeLocalProxy()
      await ProxyManager.setProxy()
      await refreshCurrentProxyAddress()
    } else if (value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
      localProxyOptions.style.display = 'none'
      addLocalProxyButton.style.display = 'none'
      await renderCustomProxies()

      // Re-activate the previously selected proxy (built-in or user).
      const activeId = await ProxyManager.getActiveCustomProxyId()

      if (activeId === 'builtin') {
        await ProxyManager.setActiveBuiltinProxy()
        await ProxyManager.setProxy()
      } else if (activeId) {
        await ProxyManager.setActiveCustomProxy(activeId)
        await ProxyManager.setProxy()
      }
      await refreshCurrentProxyAddress()
    } else if (value === 'local') {
      proxyOptionsInputs.classList.add('hidden')
      await showLocalProxySettings()
      await renderLocalProxyConfigs()
    }
  })

  ProxyManager.controlledByThisExtension()
    .then(async (controlledByThisExtension) => {
      if (controlledByThisExtension) {
        useProxyCheckbox.checked = true
        useProxyCheckbox.disabled = false

        if (!proxyingEnabled) {
          await ProxyManager.enableProxy()
        }
      }
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
    if (useProxyCheckbox.checked) {
      proxyCustomOptions.hidden = false
      useProxyCheckbox.checked = true
      await ProxyManager.enableProxy()
    } else {
      proxyCustomOptions.hidden = true
      useProxyCheckbox.checked = false
      proxyIsDown.hidden = true
      await ProxyManager.disableProxy()
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

  // ---------------------------------------------------------------------------
  // Collapsible sections (import + proxy list).
  // ---------------------------------------------------------------------------
  const wireCollapsible = (toggle, body, key) => {
    if (!toggle || !body) {
      return
    }

    const chevron = toggle.querySelector('.cproxy-chevron')

    toggle.addEventListener('click', async () => {
      const collapsed = body.classList.toggle('hidden')

      toggle.setAttribute('aria-expanded', String(!collapsed))
      if (chevron) {
        chevron.classList.toggle('cproxy-chevron--open', !collapsed)
      }

      const { proxyUiCollapsed = {} } =
        await browser.storage.local.get({ proxyUiCollapsed: {} })

      proxyUiCollapsed[key] = collapsed
      await browser.storage.local.set({ proxyUiCollapsed })
    })
  }

  const restoreCollapsibleState = async () => {
    const { proxyUiCollapsed = {} } =
      await browser.storage.local.get({ proxyUiCollapsed: {} })

    const apply = (toggle, body, collapsed) => {
      if (!toggle || !body || collapsed === undefined) {
        return
      }

      const chevron = toggle.querySelector('.cproxy-chevron')

      body.classList.toggle('hidden', collapsed)
      toggle.setAttribute('aria-expanded', String(!collapsed))
      if (chevron) {
        chevron.classList.toggle('cproxy-chevron--open', !collapsed)
      }
    }

    apply(importToggle, importBody, proxyUiCollapsed.import)
    apply(listToggle, listBody, proxyUiCollapsed.list)
  }

  wireCollapsible(importToggle, importBody, 'import')
  wireCollapsible(listToggle, listBody, 'list')
  await restoreCollapsibleState()

  // ---------------------------------------------------------------------------
  // Subscriptions / import.
  // ---------------------------------------------------------------------------
  const populateSubscriptions = () => {
    if (!subscriptionSelect) {
      return
    }

    subscriptionSelect.innerHTML = SUBSCRIPTIONS
      .map((subscription) => {
        return `<option value="${escapeHtml(subscription.id)}">${escapeHtml(subscription.name)}</option>`
      })
      .join('')
  }

  populateSubscriptions()

  const setImportStatus = (message, type = '') => {
    if (!importStatus) {
      return
    }

    importStatus.textContent = message
    importStatus.classList.remove('is-error', 'is-success', 'hidden')
    if (type) {
      importStatus.classList.add(type === 'error' ? 'is-error' : 'is-success')
    }
  }

  const getImportLimit = () => {
    const value = parseInt(importLimitInput && importLimitInput.value, 10)

    if (Number.isNaN(value) || value < 0) {
      return 100
    }
    return Math.min(value, 1000)
  }

  // Adds a freshly fetched list to storage and re-renders the form so the new
  // proxies appear immediately (no need to reopen the page).
  const importProxyList = async (proxies) => {
    if (!proxies || proxies.length === 0) {
      setImportStatus(i18nGetMessage('importNothingFound'), 'error')
      return
    }

    const { added, skipped } = await ProxyManager.bulkAddCustomProxies(proxies)

    await renderCustomProxies()
    setImportStatus(
      `${i18nGetMessage('importAdded')}: ${added} · ${i18nGetMessage('importSkipped')}: ${skipped}`,
      'success',
    )
  }

  const withImportBusy = async (task) => {
    const buttons = [loadSubscriptionButton, loadProxyListUrlButton]

    for (const element of buttons) {
      if (element) {
        element.disabled = true
      }
    }
    setImportStatus(i18nGetMessage('importLoading'))

    try {
      await task()
    } catch (error) {
      console.error('Import failed:', error)
      setImportStatus(`${i18nGetMessage('importFailed')}: ${error.message || error}`, 'error')
    } finally {
      for (const element of buttons) {
        if (element) {
          element.disabled = false
        }
      }
    }
  }

  if (loadSubscriptionButton) {
    loadSubscriptionButton.addEventListener('click', () => {
      return withImportBusy(async () => {
        const subscription = getSubscriptionById(subscriptionSelect.value)

        if (!subscription) {
          setImportStatus(i18nGetMessage('importFailed'), 'error')
          return
        }

        const proxies = await fetchProxyList(subscription.url, {
          protocol: subscription.protocol,
          limit: getImportLimit(),
          viaActiveProxy: loadViaActiveProxy && loadViaActiveProxy.checked,
        })

        await importProxyList(proxies)
      })
    })
  }

  if (loadProxyListUrlButton) {
    loadProxyListUrlButton.addEventListener('click', () => {
      return withImportBusy(async () => {
        const url = proxyListUrlInput.value.trim()

        if (!url) {
          setImportStatus(i18nGetMessage('importNoUrl'), 'error')
          return
        }

        const proxies = await fetchProxyList(url, {
          protocol: 'HTTPS',
          limit: getImportLimit(),
          viaActiveProxy: loadViaActiveProxy && loadViaActiveProxy.checked,
        })

        await importProxyList(proxies)
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Concurrent proxy checker.
  // ---------------------------------------------------------------------------
  const setCheckingUi = (checking) => {
    if (checkAllButton) {
      checkAllButton.classList.toggle('hidden', checking)
    }
    if (stopCheckButton) {
      stopCheckButton.classList.toggle('hidden', !checking)
    }
    if (removeDeadButton) {
      removeDeadButton.disabled = checking
    }
    if (loadSubscriptionButton) {
      loadSubscriptionButton.disabled = checking
    }
    if (loadProxyListUrlButton) {
      loadProxyListUrlButton.disabled = checking
    }
  }

  const updateProgress = (done, total, alive, dead) => {
    if (!checkProgress) {
      return
    }

    checkProgress.classList.remove('hidden')
    if (checkProgressFill) {
      const percent = total > 0 ? Math.round((done / total) * 100) : 0

      checkProgressFill.style.width = `${percent}%`
    }
    if (checkProgressText) {
      checkProgressText.textContent =
        `${done}/${total} · ${i18nGetMessage('proxyStatusAlive')}: ${alive} · ` +
        `${i18nGetMessage('proxyStatusDead')}: ${dead}`
    }
  }

  if (checkAllButton) {
    checkAllButton.addEventListener('click', async () => {
      if (checkController) {
        return
      }

      const proxies = await ProxyManager.getCustomProxies()

      if (proxies.length === 0) {
        return
      }

      checkController = new AbortController()
      setCheckingUi(true)

      // Reset every row to the "checking" state up-front.
      for (const proxy of proxies) {
        setRowStatus(proxy.id, 'checking')
      }

      const total = proxies.length
      let done = 0
      let alive = 0
      let dead = 0
      const removeDead = autoRemoveDead && autoRemoveDead.checked

      updateProgress(done, total, alive, dead)

      try {
        await ProxyChecker.check(proxies, {
          signal: checkController.signal,
          onResult: async (id, { status, latency }) => {
            done += 1
            if (status === 'alive') {
              alive += 1
              setRowStatus(id, 'alive', latency)
              await ProxyManager.setProxyStatus(id, { status, latency })
            } else {
              dead += 1
              await ProxyManager.setProxyStatus(id, { status, latency })
              if (removeDead) {
                // Drop dead proxies from the UI right away.
                removeRowFromDom(id)
              } else {
                setRowStatus(id, 'dead')
              }
            }
            updateProgress(done, total, alive, dead)
          },
        })
      } finally {
        // Purge the dead entries from storage in one shot. This can drop the
        // active proxy, so re-apply normal routing afterwards to match the
        // final list state.
        if (removeDead) {
          await ProxyManager.removeDeadCustomProxies()
          await ProxyManager.restoreNormalProxy()
        }
        checkController = null
        setCheckingUi(false)
        await renderCustomProxies()
      }
    })
  }

  if (stopCheckButton) {
    stopCheckButton.addEventListener('click', () => {
      if (checkController) {
        checkController.abort()
      }
    })
  }

  if (removeDeadButton) {
    removeDeadButton.addEventListener('click', async () => {
      if (checkController) {
        return
      }

      const { removed } = await ProxyManager.removeDeadCustomProxies()

      await renderCustomProxies()
      setImportStatus(`${i18nGetMessage('removedDeadProxies')}: ${removed}`, 'success')
    })
  }

  // If the page is closed mid-check, stop probing and restore normal routing so
  // the temporary checker PAC never lingers.
  window.addEventListener('pagehide', () => {
    if (checkController) {
      checkController.abort()
      ProxyManager.restoreNormalProxy()
    }
  })
})()
