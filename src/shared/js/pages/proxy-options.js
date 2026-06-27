import browser from 'Background/browser-api'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import { i18nGetMessage, parseProxyList, parseProxyString } from 'Background/utilities'

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
  const testAllProxiesButton = document.getElementById('testAllProxiesButton')
  const proxyTestTargetSelect = document.getElementById('proxyTestTarget')
  const pasteProxiesButton = document.getElementById('pasteProxiesButton')
  const autoDeleteDeadProxiesCheckbox = document.getElementById('autoDeleteDeadProxies')
  const proxyImportMsg = document.getElementById('proxyImportMsg')

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

  // Builds the alive/dead/latency badge from a stored status entry.
  const statusBadgeHtml = (status) => {
    if (!status) {
      return `<span class="cproxy-status cproxy-status--unknown">${escapeHtml(i18nGetMessage('proxyStatusUntested'))}</span>`
    }
    if (status.alive) {
      return `<span class="cproxy-status cproxy-status--alive">${status.latency} ${escapeHtml(i18nGetMessage('proxyLatencyUnit'))}</span>`
    }
    return `<span class="cproxy-status cproxy-status--dead">${escapeHtml(i18nGetMessage('proxyStatusDead'))}</span>`
  }

  // Renders one row (built-in or user) in the unified proxy list. A checked
  // row is part of the proxy chain; `chain` is the ordered list of ids so we
  // can show each row's position in it. `statuses` holds the last test result.
  const renderProxyRow = ({ id, name, protocol, uri, builtin = false }, chain, statuses) => {
    const editTitle = i18nGetMessage(builtin ? 'editBuiltinProxyButton' : 'editProxyButton')
    const chainIndex = chain.indexOf(id)
    const inChain = chainIndex !== -1
    const order = inChain
      ? `<span class="cproxy-order" title="${escapeHtml(i18nGetMessage('proxyChainPositionTitle'))}">${chainIndex + 1}</span>`
      : ''
    const badge = builtin
      ? `<span class="cproxy-badge">${escapeHtml(i18nGetMessage('builtinProxyBadge'))}</span>`
      : ''
    const deleteBtn = builtin
      ? ''
      : `<button type="button" class="cproxy-icon-btn cproxy-del" data-id="${id}"
            title="${escapeHtml(i18nGetMessage('deleteProxyButton'))}">
          <svg width="20" height="20" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-width="3"/>
          </svg>
        </button>`

    return `
     <div class="cproxy-row${inChain ? ' cproxy-row--active' : ''}" data-id="${id}">
       <label class="cproxy-row__main">
         <input type="checkbox" name="chain-proxy" value="${id}" ${inChain ? 'checked' : ''}/>
         ${order}
         <span class="cproxy-row__text">
           <span class="cproxy-row__name">${escapeHtml(name)}</span>
           <span class="cproxy-row__addr">${escapeHtml(protocol)} ${escapeHtml(uri)}</span>
         </span>
         ${badge}
       </label>
       <span class="cproxy-status-cell">${statusBadgeHtml(statuses[id])}</span>
       <div class="cproxy-row__actions">
         <button type="button" class="cproxy-icon-btn cproxy-test"
                 data-id="${id}" title="${escapeHtml(i18nGetMessage('testProxyButton'))}">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             <path d="M20 4v4h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
         </button>
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
    const chain = await ProxyManager.getProxyChain()
    const statuses = await ProxyManager.getProxyStatuses()

    let html = ''

    if (builtin) {
      html += renderProxyRow({
        id: 'builtin',
        name: i18nGetMessage('builtinProxyName'),
        protocol: builtin.protocol,
        uri: builtin.uri,
        builtin: true,
      }, chain, statuses)
    }

    for (const proxy of proxies) {
      html += renderProxyRow(proxy, chain, statuses)
    }

    customProxyList.innerHTML = html
    await refreshCurrentProxyAddress()
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

    // Prefer showing the full chain (proxies tried one after another).
    const chainConfigs = await ProxyManager.getChainProxyConfigs()

    if (chainConfigs.length > 0) {
      currentProxyAddressValue.textContent = chainConfigs
        .map(({ protocol, uri }) => `${protocol} ${uri}`)
        .join('  →  ')
      currentProxyAddress.hidden = false
      return
    }

    const { proxyServerProtocol, proxyServerURI } = await ProxyManager.getProxyingRules()

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

  // Collects every testable proxy (built-in + user) as {id, protocol, uri}.
  const collectTestableProxies = async () => {
    const proxies = await ProxyManager.getCustomProxies()
    const list = proxies.map(({ id, protocol, uri }) => ({ id, protocol, uri }))
    const builtin = await ProxyManager.getBuiltinProxy()

    if (builtin) {
      list.unshift({ id: 'builtin', protocol: builtin.protocol, uri: builtin.uri })
    }
    return list
  }

  const rowStatusCell = (id) => {
    return customProxyList.querySelector(
      `.cproxy-row[data-id="${id}"] .cproxy-status-cell`,
    )
  }

  const setRowChecking = (id) => {
    const cell = rowStatusCell(id)

    if (cell) {
      cell.innerHTML =
        `<span class="cproxy-status cproxy-status--checking">${i18nGetMessage('proxyStatusChecking')}</span>`
    }
  }

  const setRowStatus = (id, status) => {
    const cell = rowStatusCell(id)

    if (!cell) {
      return
    }
    if (status.alive) {
      cell.innerHTML =
        `<span class="cproxy-status cproxy-status--alive">${status.latency} ${i18nGetMessage('proxyLatencyUnit')}</span>`
    } else {
      cell.innerHTML =
        `<span class="cproxy-status cproxy-status--dead">${i18nGetMessage('proxyStatusDead')}</span>`
    }
  }

  // Toggle a proxy's membership in the chain (built-in or user). Marked
  // proxies are tried one after another, in the order they were marked.
  customProxyList.addEventListener('change', async (event) => {
    if (event.target.name !== 'chain-proxy') {
      return
    }

    const id = event.target.value
    const chain = await ProxyManager.getProxyChain()
    let nextChain

    if (event.target.checked) {
      nextChain = chain.includes(id) ? chain : [...chain, id]
    } else {
      nextChain = chain.filter((chainId) => chainId !== id)
    }

    await ProxyManager.setProxyChain(nextChain)
    await ProxyManager.setProxy()
    await renderCustomProxies()
    console.log(`Proxy chain updated: ${nextChain.join(', ')}`)
  })

  // Handle test / edit / delete actions on rows.
  customProxyList.addEventListener('click', async (event) => {
    const testButton = event.target.closest('.cproxy-test')

    if (testButton) {
      const id = testButton.dataset.id
      const list = await collectTestableProxies()
      const proxy = list.find((item) => item.id === id)

      if (!proxy) {
        return
      }
      setRowChecking(id)
      setRowStatus(id, await ProxyManager.testProxy(proxy))
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

  // Test every proxy in the list, updating each row's status live.
  if (testAllProxiesButton) {
    testAllProxiesButton.addEventListener('click', async () => {
      const list = await collectTestableProxies()

      if (list.length === 0) {
        return
      }
      testAllProxiesButton.disabled = true
      for (const proxy of list) {
        setRowChecking(proxy.id)
      }
      try {
        await ProxyManager.testProxies(list, {
          onResult: (id, status) => setRowStatus(id, status),
        })
      } finally {
        testAllProxiesButton.disabled = false
      }
    })
  }

  // Remember which cloud endpoint to probe against.
  if (proxyTestTargetSelect) {
    proxyTestTargetSelect.value = await ProxyManager.getProxyTestTarget()
    proxyTestTargetSelect.addEventListener('change', async () => {
      await ProxyManager.setProxyTestTarget(proxyTestTargetSelect.value)
    })
  }

  // Short feedback line shown under the list after an import.
  const showImportMsg = (text) => {
    if (proxyImportMsg) {
      proxyImportMsg.textContent = text
      proxyImportMsg.hidden = !text
    }
  }

  // Imports proxies from pasted/typed text: adds the new ones, tests them
  // live and (optionally) removes the dead ones.
  const importProxiesFromText = async (text) => {
    const parsed = parseProxyList(text)

    if (parsed.length === 0) {
      showImportMsg(i18nGetMessage('noProxiesInClipboard'))
      return
    }

    const added = await ProxyManager.addCustomProxies(parsed)

    await renderCustomProxies()

    if (added.length === 0) {
      showImportMsg(i18nGetMessage('noProxiesInClipboard'))
      return
    }

    for (const proxy of added) {
      setRowChecking(proxy.id)
    }

    const results = await ProxyManager.testProxies(added, {
      onResult: (id, status) => setRowStatus(id, status),
    })
    const aliveCount =
      added.filter((proxy) => results[proxy.id] && results[proxy.id].alive).length
    let removedCount = 0

    if (await ProxyManager.getAutoDeleteDeadProxies()) {
      for (const proxy of added) {
        if (!results[proxy.id] || !results[proxy.id].alive) {
          await ProxyManager.deleteCustomProxy(proxy.id)
          removedCount += 1
        }
      }
      if (removedCount > 0) {
        await ProxyManager.setProxy()
        await renderCustomProxies()
      }
    }

    let summary = `${i18nGetMessage('proxiesImportedLabel')}: +${added.length}  ✓${aliveCount}`

    if (removedCount > 0) {
      summary += `  ✗${removedCount}`
    }
    showImportMsg(summary)
  }

  // Explicit "paste list" button (reads the clipboard directly).
  if (pasteProxiesButton) {
    pasteProxiesButton.addEventListener('click', async () => {
      try {
        await importProxiesFromText(await navigator.clipboard.readText())
      } catch (error) {
        showImportMsg(i18nGetMessage('clipboardReadFailed'))
      }
    })
  }

  // Ctrl+V anywhere on the page (outside the form fields) imports a list.
  document.addEventListener('paste', async (event) => {
    if (event.target.closest('input, textarea')) {
      return
    }
    if (proxyOptionsInputs.classList.contains('hidden')) {
      return
    }

    const clipboard = event.clipboardData || window.clipboardData
    const text = clipboard ? clipboard.getData('text') : ''

    if (text && text.trim()) {
      event.preventDefault()
      await importProxiesFromText(text)
    }
  })

  // Persisted "auto-remove dead proxies" preference.
  if (autoDeleteDeadProxiesCheckbox) {
    autoDeleteDeadProxiesCheckbox.checked =
      await ProxyManager.getAutoDeleteDeadProxies()
    autoDeleteDeadProxiesCheckbox.addEventListener('change', async () => {
      await ProxyManager.setAutoDeleteDeadProxies(
        autoDeleteDeadProxiesCheckbox.checked,
      )
    })
  }

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

      // Re-apply the previously configured chain (if any).
      const chain = await ProxyManager.getProxyChain()

      if (chain.length > 0) {
        await ProxyManager.setProxyChain(chain)
        await ProxyManager.setProxy()
      }
      await renderCustomProxies()
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
})()
