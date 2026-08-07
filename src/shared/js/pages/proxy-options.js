import browser from 'Background/browser-api'
import { RECOMMENDED_PROXY_SOURCES } from 'Background/constants'
import {
  countryFlagEmoji,
  getCachedGeo,
  hostFromUri,
  isIpv4,
  lookupCountries,
} from 'Background/geoip'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import * as server from 'Background/server'
import {
  formatProxyForShare,
  i18nGetMessage,
  parseProxyList,
  parseProxyString,
} from 'Background/utilities'

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
  const copyAllProxiesButton = document.getElementById('copyAllProxiesButton')
  const autoDeleteDeadProxiesCheckbox = document.getElementById('autoDeleteDeadProxies')
  const proxyAllTrafficCheckbox = document.getElementById('proxyAllTraffic')
  const emptyRegistryHint = document.getElementById('emptyRegistryHint')
  const proxyImportMsg = document.getElementById('proxyImportMsg')
  const proxySourcesEnabledCheckbox = document.getElementById('proxySourcesEnabled')
  const proxySourcesListTextarea = document.getElementById('proxySourcesList')
  const proxySourcesIntervalInput = document.getElementById('proxySourcesInterval')
  const proxySourcesUseProxyCheckbox = document.getElementById('proxySourcesUseProxy')
  const proxySourcesAutoTestCheckbox = document.getElementById('proxySourcesAutoTest')
  const fetchProxySourcesButton = document.getElementById('fetchProxySourcesButton')
  const proxySourcesStatus = document.getElementById('proxySourcesStatus')
  const stopTestProxiesButton = document.getElementById('stopTestProxiesButton')
  const removeDeadProxiesButton = document.getElementById('removeDeadProxiesButton')
  const removeUntestedProxiesButton = document.getElementById('removeUntestedProxiesButton')
  const removeUncheckedProxiesButton = document.getElementById('removeUncheckedProxiesButton')
  const removeDuplicateProxiesButton = document.getElementById('removeDuplicateProxiesButton')
  const removeAllProxiesButton = document.getElementById('removeAllProxiesButton')
  const proxyListToggle = document.getElementById('proxyListToggle')
  const proxyListBody = document.getElementById('proxyListBody')
  const proxyCount = document.getElementById('proxyCount')
  const proxySourcesToggle = document.getElementById('proxySourcesToggle')
  const proxySourcesBody = document.getElementById('proxySourcesBody')
  const proxySourcesPreset = document.getElementById('proxySourcesPreset')
  const addProxySourcePreset = document.getElementById('addProxySourcePreset')
  const checkProgress = document.getElementById('checkProgress')
  const checkProgressFill = document.getElementById('checkProgressFill')
  const checkProgressText = document.getElementById('checkProgressText')
  const countryFilterToggle = document.getElementById('countryFilterToggle')
  const countryFilterBody = document.getElementById('countryFilterBody')
  const countryFilterSummary = document.getElementById('countryFilterSummary')
  const countryFilterMode = document.getElementById('countryFilterMode')
  const countryFilterListInput = document.getElementById('countryFilterList')
  const countryFilterAuto = document.getElementById('countryFilterAuto')
  const countryFilterUnknown = document.getElementById('countryFilterUnknown')
  const applyCountryFilterButton = document.getElementById('applyCountryFilterButton')
  const detectCountriesButton = document.getElementById('detectCountriesButton')
  const countryDetectStatus = document.getElementById('countryDetectStatus')
  const detectedCountriesList = document.getElementById('detectedCountriesList')
  const keepOnlyCountrySelect = document.getElementById('keepOnlyCountry')
  const keepOnlyCountryButton = document.getElementById('keepOnlyCountryButton')

  // Holds the AbortController of an in-flight "test all" run (null when idle).
  let checkController = null

  // Refreshes the country picker. Assigned by the country-filter block further
  // down; declared here so the list renderer can call it without depending on
  // definition order.
  let refreshCountryPicker = async () => {}

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
        console.log(`Config ${configId} has been deleted`)

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
      // The config id and name come from the local proxy daemon's HTTP API,
      // i.e. across a trust boundary, so neither goes into markup unescaped.
      const safeId = escapeHtml(id)
      const safeName = escapeHtml(name)

      div.innerHTML = `
       <div class="radio-button proxy-list__block-item">
        <input class="radio-button-input" type="radio" name="local-proxy" id="${safeId}" value="${safeId}"
          ${isActive ? 'checked' : ''} data-config-name="${safeName}"/>
        <label class="radio-button-label" for="${safeId}">${safeName}</label>
        <div class="proxy-list__block-item__btn delete-config" data-id="${safeId}">
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

  // Testing/fetching temporarily rewrites the global proxy and restores it in
  // a `finally`. If the page is closed mid-flight that restore never runs, so
  // this flag lets a `pagehide` handler put the real proxy back as a fallback.
  let proxyTestingInProgress = false

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

  // Builds the alive/dead/untested badge from a stored status entry (the
  // latency itself lives in its own "site" column).
  const statusBadgeHtml = (status) => {
    if (!status) {
      return `<span class="cproxy-status cproxy-status--unknown">${escapeHtml(i18nGetMessage('proxyStatusUntested'))}</span>`
    }
    if (status.alive) {
      return `<span class="cproxy-status cproxy-status--alive">${escapeHtml(i18nGetMessage('proxyStatusAlive'))}</span>`
    }
    // Reachable but rejected us for lack of credentials — worth telling apart
    // from "dead", since the fix is to edit the proxy, not to delete it.
    if (status.needsAuth) {
      return `<span class="cproxy-status cproxy-status--needsauth">${escapeHtml(i18nGetMessage('proxyStatusNeedsAuth'))}</span>`
    }
    return `<span class="cproxy-status cproxy-status--dead">${escapeHtml(i18nGetMessage('proxyStatusDead'))}</span>`
  }

  const EMPTY_CELL = '<span class="cproxy-cell--empty">—</span>'

  // Milliseconds cell (ping / site-open latency columns).
  const msCellHtml = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${value} ${escapeHtml(i18nGetMessage('proxyLatencyUnit'))}`
    }
    return EMPTY_CELL
  }

  // Builds the country flag/code badge from a cached geo entry.
  const countryBadgeHtml = (uri, geo) => {
    const info = geo[hostFromUri(uri)]

    if (!info || !info.code) {
      return EMPTY_CELL
    }

    const flag = countryFlagEmoji(info.code)

    return `<span class="cproxy-country" title="${escapeHtml(info.name || info.code)}">` +
      `${flag ? `${flag} ` : ''}${escapeHtml(info.code)}</span>`
  }

  // Exit-country cell: the country seen by websites when going through the
  // proxy (detected via an IP-echo request routed through it). The tooltip
  // carries the exit IP.
  const exitCellHtml = (status) => {
    if (!status || (!status.exitCountry && !status.exitIp)) {
      return EMPTY_CELL
    }

    const code = status.exitCountry || ''
    const flag = code ? countryFlagEmoji(code) : ''
    const title = [code, status.exitIp].filter(Boolean).join(' · ')
    const label = code ? `${flag ? `${flag} ` : ''}${escapeHtml(code)}` : 'IP'

    return `<span class="cproxy-country" title="${escapeHtml(title)}">${label}</span>`
  }

  // Header row of the proxy datagrid: one labelled column per parameter.
  const renderGridHeader = () => {
    // `sortKey` makes the column clickable; the arrow marks the active one.
    const col = (key, sortKey, titleKey) => {
      const hint = titleKey ? i18nGetMessage(titleKey) : ''
      const active = currentSort.key === sortKey
      const arrow = active
        ? ` <span class="cproxy-sort-arrow">${currentSort.dir === 'asc' ? '▲' : '▼'}</span>`
        : ''
      const title = [hint, i18nGetMessage('proxySortHint')]
        .filter(Boolean)
        .join(' · ')

      return `<span class="cproxy-col--sortable${active ? ' cproxy-col--sorted' : ''}"
        data-sort="${escapeHtml(sortKey)}" role="button" tabindex="0"
        title="${escapeHtml(title)}">${escapeHtml(i18nGetMessage(key))}${arrow}</span>`
    }

    return `
     <div class="cproxy-row cproxy-grid__header">
       <span></span>
       ${col('proxyColName', 'name')}
       ${col('proxyColAddress', 'address')}
       ${col('proxyColCountry', 'country', 'proxyColCountryTitle')}
       ${col('proxyColExit', 'exit', 'proxyColExitTitle')}
       ${col('proxyColPing', 'ping', 'proxyColPingTitle')}
       ${col('proxyColSite', 'site', 'proxyColSiteTitle')}
       ${col('proxyColStatus', 'status')}
       <span></span>
     </div>`
  }

  // Which column the datagrid is sorted by. This is a *view* preference: the
  // stored list order is left alone, so sorting never disturbs the chain or
  // the order the checker walks the list in.
  const currentSort = { key: null, dir: 'asc' }

  // Comparable value per column. Rows with nothing to compare sort last in
  // both directions, so "sort by ping" never buries the tested proxies under
  // a wall of untested ones.
  const LAST = Number.MAX_SAFE_INTEGER
  const sortValue = (proxy, key, { chain, statuses, geo }) => {
    const status = statuses[proxy.id]

    switch (key) {
      case 'name':
        return (proxy.name || proxy.uri || '').toLowerCase()
      case 'address':
        return `${proxy.protocol || ''} ${proxy.uri || ''}`.toLowerCase()
      case 'country': {
        const info = geo[hostFromUri(proxy.uri)]

        return info && info.code ? info.code.toUpperCase() : ''
      }
      case 'exit':
        return (status && status.exitCountry) || ''
      case 'ping':
        return status && typeof status.ping === 'number' ? status.ping : LAST
      case 'site':
        return status && status.alive && typeof status.latency === 'number'
          ? status.latency
          : LAST
      case 'status':
        // alive, then auth-required, then dead, then untested.
        if (!status) {
          return 3
        }
        if (status.alive) {
          return 0
        }
        return status.needsAuth ? 1 : 2
      default:
        return 0
    }
  }

  const sortProxiesForView = (proxies, context) => {
    if (!currentSort.key) {
      return proxies
    }

    const direction = currentSort.dir === 'asc' ? 1 : -1

    return proxies
      .map((proxy, index) => ({ proxy, index }))
      .sort((first, second) => {
        const left = sortValue(first.proxy, currentSort.key, context)
        const right = sortValue(second.proxy, currentSort.key, context)

        // Empty strings behave like the numeric sentinel: always last.
        if (left === '' && right !== '') {
          return 1
        }
        if (right === '' && left !== '') {
          return -1
        }
        if (left < right) {
          return -direction
        }
        if (left > right) {
          return direction
        }
        // Stable: equal values keep their original order.
        return first.index - second.index
      })
      .map((entry) => entry.proxy)
  }

  // Renders one row (built-in or user) of the proxy datagrid. A checked row
  // is part of the proxy chain; `chain` is the ordered list of ids so we can
  // show each row's position in it. `statuses` holds the last test result,
  // `geo` the cached host -> country map. Every parameter gets its own
  // column: country (by proxy host IP), exit country (seen through the
  // proxy), ping, site-open latency and status.
  const renderProxyRow = (
    { id, name, protocol, uri, builtin = false },
    chain,
    statuses,
    geo,
  ) => {
    const editTitle = i18nGetMessage(builtin ? 'editBuiltinProxyButton' : 'editProxyButton')
    const chainIndex = chain.indexOf(id)
    const inChain = chainIndex !== -1
    const order = inChain
      ? `<span class="cproxy-order" title="${escapeHtml(i18nGetMessage('proxyChainPositionTitle'))}">${chainIndex + 1}</span>`
      : ''
    const status = statuses[id]
    const badge = builtin
      ? ` <span class="cproxy-badge">${escapeHtml(i18nGetMessage('builtinProxyBadge'))}</span>`
      : ''
    // Ids are generated internally, but they also survive a settings import,
    // so they are escaped like any other value reaching the markup.
    const safeId = escapeHtml(id)
    const deleteBtn = builtin
      ? ''
      : `<button type="button" class="cproxy-icon-btn cproxy-del" data-id="${safeId}"
            title="${escapeHtml(i18nGetMessage('deleteProxyButton'))}">
          <svg width="20" height="20" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-width="3"/>
          </svg>
        </button>`

    return `
     <div class="cproxy-row${inChain ? ' cproxy-row--active' : ''}" data-id="${safeId}">
       <label class="cproxy-row__main">
         <input type="checkbox" name="chain-proxy" value="${safeId}" ${inChain ? 'checked' : ''}/>
         ${order}
       </label>
       <span class="cproxy-row__name" title="${escapeHtml(name)}">${escapeHtml(name)}${badge}</span>
       <span class="cproxy-row__addr">${escapeHtml(protocol)} ${escapeHtml(uri)}</span>
       <span class="cproxy-country-cell">${countryBadgeHtml(uri, geo)}</span>
       <span class="cproxy-exit-cell">${exitCellHtml(status)}</span>
       <span class="cproxy-ping-cell">${msCellHtml(status && status.ping)}</span>
       <span class="cproxy-site-cell">${msCellHtml(status && status.alive ? status.latency : null)}</span>
       <span class="cproxy-status-cell">${statusBadgeHtml(status)}</span>
       <div class="cproxy-row__actions">
         <button type="button" class="cproxy-icon-btn cproxy-copy"
                 data-id="${safeId}" title="${escapeHtml(i18nGetMessage('shareProxyButton'))}">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
             <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
           </svg>
         </button>
         <button type="button" class="cproxy-icon-btn cproxy-test"
                 data-id="${safeId}" title="${escapeHtml(i18nGetMessage('testProxyButton'))}">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
             <path d="M20 4v4h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
         </button>
         <button type="button" class="cproxy-icon-btn cproxy-edit"
                 data-id="${safeId}" data-builtin="${builtin}" title="${escapeHtml(editTitle)}">
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
    const geo = await getCachedGeo()

    let html = ''

    if (builtin) {
      html += renderProxyRow({
        id: 'builtin',
        name: i18nGetMessage('builtinProxyName'),
        protocol: builtin.protocol,
        uri: builtin.uri,
        builtin: true,
      }, chain, statuses, geo)
    }

    // The built-in proxy stays pinned at the top; only the user's own entries
    // are reordered.
    for (const proxy of sortProxiesForView(proxies, { chain, statuses, geo })) {
      html += renderProxyRow(proxy, chain, statuses, geo)
    }

    customProxyList.innerHTML = html ? renderGridHeader() + html : ''
    if (proxyCount) {
      proxyCount.textContent = proxies.length > 0
        ? `${proxies.length} ${i18nGetMessage('proxiesCountSuffix')}`
        : ''
    }
    await refreshCurrentProxyAddress()

    // Fill in any missing country flags in the background (cached, never blocks
    // the render, re-renders itself when done).
    ensureCountries()
  }

  // Looks up the country of any proxy IP we don't know yet (cached, batched),
  // then refreshes the rows so the flags appear. Safe to call repeatedly: it
  // no-ops once every IP is cached, and never throws.
  let geoLookupInFlight = false

  async function ensureCountries () {
    if (geoLookupInFlight || checkController) {
      return
    }

    const proxies = await ProxyManager.getCustomProxies()
    const builtin = await ProxyManager.getBuiltinProxy()
    const hosts = proxies.map((proxy) => hostFromUri(proxy.uri))

    if (builtin) {
      hosts.push(hostFromUri(builtin.uri))
    }

    const cache = await getCachedGeo()
    const missing = hosts.filter((host) => isIpv4(host) && !(host in cache))

    if (missing.length === 0) {
      return
    }

    geoLookupInFlight = true
    try {
      await lookupCountries(missing)
      await renderCustomProxies()
      await refreshCountryPicker()
    } catch (error) {
      console.warn(`Country detection failed: ${error}`)
    } finally {
      geoLookupInFlight = false
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
  const loadProxyIntoForm = ({ id, name, protocol, uri, credentials, builtin }) => {
    editingProxyId = builtin ? null : id
    if (proxyNameInput) {
      proxyNameInput.value = builtin ? i18nGetMessage('builtinProxyName') : name
    }
    // Keep any credentials in the field so editing preserves them.
    proxyServerInput.value = credentials ? `${credentials}@${uri}` : uri
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

  const rowCell = (id, cellClass) => {
    return customProxyList.querySelector(
      `.cproxy-row[data-id="${id}"] .${cellClass}`,
    )
  }

  const rowStatusCell = (id) => rowCell(id, 'cproxy-status-cell')

  // Removes a row from the list immediately (used to drop dead proxies on the
  // fly during a check, without waiting for a full re-render).
  const removeRowFromList = (id) => {
    const row = customProxyList.querySelector(`.cproxy-row[data-id="${id}"]`)

    if (row) {
      row.remove()
    }
  }

  const setRowChecking = (id) => {
    const cell = rowStatusCell(id)

    if (cell) {
      cell.innerHTML =
        `<span class="cproxy-status cproxy-status--checking">${escapeHtml(i18nGetMessage('proxyStatusChecking'))}</span>`
    }
  }

  // Rows are marked "queued" up front and flipped to "checking" only when
  // their batch actually starts, so a 200-proxy run no longer claims to be
  // probing all 200 at once.
  const setRowQueued = (id) => {
    const cell = rowStatusCell(id)

    if (cell) {
      cell.innerHTML =
        `<span class="cproxy-status cproxy-status--queued">${escapeHtml(i18nGetMessage('proxyStatusQueued'))}</span>`
    }
  }

  // Live-updates every measured column of a row from a fresh test result:
  // status, ping, site-open latency and exit country.
  const setRowStatus = (id, status) => {
    const statusCell = rowStatusCell(id)

    if (!statusCell) {
      return
    }
    statusCell.innerHTML = statusBadgeHtml(status)

    const pingCell = rowCell(id, 'cproxy-ping-cell')
    const siteCell = rowCell(id, 'cproxy-site-cell')
    const exitCell = rowCell(id, 'cproxy-exit-cell')

    if (pingCell) {
      pingCell.innerHTML = msCellHtml(status.ping)
    }
    if (siteCell) {
      siteCell.innerHTML = msCellHtml(status.alive ? status.latency : null)
    }
    if (exitCell) {
      exitCell.innerHTML = exitCellHtml(status)
    }
  }

  // Short feedback line shown under the list (imports, copy).
  const showImportMsg = (text) => {
    if (proxyImportMsg) {
      proxyImportMsg.textContent = text
      proxyImportMsg.hidden = !text
    }
  }

  // Copies text to the clipboard, falling back to execCommand when the async
  // Clipboard API is unavailable.
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      try {
        const textarea = document.createElement('textarea')

        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.append(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
        return true
      } catch (fallbackError) {
        return false
      }
    }
  }

  // Toggle a proxy's membership in the chain (built-in or user). Marked
  // proxies are tried one after another, in the order they were marked.
  // Keyboard parity for the sortable headers (they are role="button").
  customProxyList.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const header = event.target.closest('.cproxy-col--sortable')

    if (header) {
      event.preventDefault()
      await applySort(header)
    }
  })

  customProxyList.addEventListener('change', async (event) => {
    if (event.target.name !== 'chain-proxy') {
      return
    }

    // Changing the chain mid-check would clobber the temporary checker PAC.
    if (checkController) {
      event.target.checked = !event.target.checked
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

  // Handle copy / test / edit / delete actions on rows.
  // Column sorting. Handled before the check guard: reordering rows is a view
  // change, so it stays available while a check is running.
  const applySort = async (header) => {
    const key = header.dataset.sort

    if (!key) {
      return
    }

    if (currentSort.key === key) {
      currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc'
    } else {
      currentSort.key = key
      currentSort.dir = 'asc'
    }
    await renderCustomProxies()
  }

  customProxyList.addEventListener('click', async (event) => {
    const header = event.target.closest('.cproxy-col--sortable')

    if (header) {
      await applySort(header)
      return
    }

    // Don't run single-row actions while a full check owns the proxy PAC.
    if (checkController) {
      return
    }

    const copyButton = event.target.closest('.cproxy-copy')

    if (copyButton) {
      const id = copyButton.dataset.id
      let proxy

      if (id === 'builtin') {
        proxy = await ProxyManager.getBuiltinProxy()
      } else {
        const proxies = await ProxyManager.getCustomProxies()

        proxy = proxies.find((item) => item.id === id)
      }

      if (proxy && await copyToClipboard(formatProxyForShare(proxy))) {
        showImportMsg(i18nGetMessage('proxyCopied'))
      }
      return
    }

    const testButton = event.target.closest('.cproxy-test')

    if (testButton) {
      const id = testButton.dataset.id
      const list = await collectTestableProxies()
      const proxy = list.find((item) => item.id === id)

      if (!proxy) {
        return
      }
      setRowChecking(id)
      proxyTestingInProgress = true
      try {
        setRowStatus(id, await ProxyManager.testProxy(proxy))
      } finally {
        proxyTestingInProgress = false
      }
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

  const updateCheckProgress = (done, total, alive, dead) => {
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
        `${done}/${total} · ${i18nGetMessage('proxyStatusAliveShort')}: ${alive} · ` +
        `${i18nGetMessage('proxyStatusDead')}: ${dead}`
    }
  }

  // Test every proxy in the list in parallel, updating each row live. The run
  // can be stopped, and dead proxies are dropped on the fly when auto-delete is
  // on. The user's real traffic stays on the active proxy for the whole run.
  if (testAllProxiesButton) {
    testAllProxiesButton.addEventListener('click', async () => {
      if (checkController) {
        return
      }

      // Drop the unwanted countries first: a proxy removed here never costs a
      // probe slot or a connection timeout during the scan.
      const countryFilter = await ProxyManager.getCountryFilterSettings()

      if (countryFilter.auto && countryFilter.mode !== 'off') {
        const { removed } = await ProxyManager.applyCountryFilter(null, {
          settings: countryFilter,
          onProgress: (done, total) => {
            setCountryDetectStatus(
              `${i18nGetMessage('detectingCountriesLabel')} ${done}/${total}`,
            )
          },
        })

        if (removed > 0) {
          await ProxyManager.restoreProxy()
          await renderCustomProxies()
          await renderDetectedCountries()
          setCountryDetectStatus(
            `${i18nGetMessage('countryFilterRemovedLabel')}: ${removed}`,
          )
        } else {
          setCountryDetectStatus('')
        }
      }

      const list = await collectTestableProxies()

      if (list.length === 0) {
        return
      }

      const autoDelete = await ProxyManager.getAutoDeleteDeadProxies()

      checkController = new AbortController()
      proxyTestingInProgress = true
      testAllProxiesButton.classList.add('hidden')
      if (stopTestProxiesButton) {
        stopTestProxiesButton.classList.remove('hidden')
      }
      if (removeDeadProxiesButton) {
        removeDeadProxiesButton.disabled = true
      }

      for (const proxy of list) {
        setRowQueued(proxy.id)
      }

      const total = list.length
      let done = 0
      let alive = 0
      let dead = 0

      updateCheckProgress(done, total, alive, dead)

      try {
        // `onResult` only touches the DOM — it must never write to storage,
        // because the parallel probes resolve together and concurrent
        // read-modify-write deletes would race and lose updates. The actual
        // removal happens once, after the run, via removeDeadCustomProxies().
        await ProxyManager.testProxies(list, {
          signal: checkController.signal,
          onBatchStart: (ids) => {
            for (const id of ids) {
              setRowChecking(id)
            }
          },
          onResult: (id, status) => {
            done += 1
            if (status.alive) {
              alive += 1
              setRowStatus(id, status)
            } else {
              // A proxy that answered 407 is reachable and is kept by
              // removeDeadCustomProxies(), so it is neither counted as dead
              // nor hidden — otherwise the row would vanish from a list it is
              // still in.
              if (!status.needsAuth) {
                dead += 1
              }
              // Instant visual feedback; the built-in proxy is never removable.
              if (autoDelete && !status.needsAuth && id !== 'builtin') {
                removeRowFromList(id)
              } else {
                setRowStatus(id, status)
              }
            }
            updateCheckProgress(done, total, alive, dead)
          },
        })
      } finally {
        checkController = null
        proxyTestingInProgress = false
        testAllProxiesButton.classList.remove('hidden')
        if (stopTestProxiesButton) {
          stopTestProxiesButton.classList.add('hidden')
        }
        if (removeDeadProxiesButton) {
          removeDeadProxiesButton.disabled = false
        }
        if (checkProgress) {
          checkProgress.classList.add('hidden')
        }
        // Purge the dead proxies in one atomic pass (avoids the lost-update
        // race), then re-apply routing (auto-delete may have dropped the
        // active proxy) and re-sync the list with storage.
        if (autoDelete) {
          await ProxyManager.removeDeadCustomProxies()
        }
        await ProxyManager.restoreProxy()
        await renderCustomProxies()
      }
    })
  }

  // Stop an in-flight "test all" run.
  if (stopTestProxiesButton) {
    stopTestProxiesButton.addEventListener('click', () => {
      if (checkController) {
        checkController.abort()
      }
    })
  }

  // Shared wiring for the bulk-removal buttons: each removes a subset of the
  // list in one atomic pass, re-applies routing (the active proxy may have
  // been dropped) and reports how many entries went away.
  const setupBulkRemoveButton = (button, removeAction, { confirmKey } = {}) => {
    if (!button) {
      return
    }

    button.addEventListener('click', async () => {
      if (checkController) {
        return
      }

      if (confirmKey && !window.confirm(i18nGetMessage(confirmKey))) {
        return
      }

      const { removed } = await removeAction()

      await ProxyManager.restoreProxy()
      await renderCustomProxies()
      showImportMsg(`${i18nGetMessage('removedDeadProxiesLabel')}: ${removed}`)
    })
  }

  // Manually remove every proxy the last check marked dead.
  setupBulkRemoveButton(
    removeDeadProxiesButton,
    () => ProxyManager.removeDeadCustomProxies(),
  )
  // Remove every proxy that has never been tested.
  setupBulkRemoveButton(
    removeUntestedProxiesButton,
    () => ProxyManager.removeUntestedCustomProxies(),
  )
  // Collapse proxies pointing at the same endpoint, keeping the first of each.
  setupBulkRemoveButton(
    removeDuplicateProxiesButton,
    () => ProxyManager.removeDuplicateCustomProxies(),
  )
  // Remove every proxy that is not ticked into the chain.
  setupBulkRemoveButton(
    removeUncheckedProxiesButton,
    () => ProxyManager.removeUncheckedCustomProxies(),
  )
  // Remove the whole list (asks for confirmation first).
  setupBulkRemoveButton(
    removeAllProxiesButton,
    () => ProxyManager.removeAllCustomProxies(),
    { confirmKey: 'removeAllProxiesConfirm' },
  )

  // ---------------------------------------------------------------------------
  // Country pre-filter
  //
  // A proxy's country comes from a geo-IP lookup of its entry address, so it is
  // known without connecting to anything. That lets the user throw away whole
  // countries BEFORE a scan is started — the discarded proxies never cost a
  // probe slot or a timeout.
  // ---------------------------------------------------------------------------

  const setCountryDetectStatus = (text) => {
    if (countryDetectStatus) {
      countryDetectStatus.textContent = text || ''
    }
  }

  // Fills the "keep only" picker and the free-text datalist from the countries
  // actually present in the list, so the user picks from what they have.
  const renderDetectedCountries = async () => {
    if (!keepOnlyCountrySelect && !detectedCountriesList) {
      return
    }

    const proxies = await ProxyManager.getCustomProxies()
    const geo = await getCachedGeo()
    const counts = new Map()

    for (const proxy of proxies) {
      const info = geo[hostFromUri(proxy.uri)]
      const code = info && info.code ? info.code.toUpperCase() : ''

      if (!code) {
        continue
      }

      const entry = counts.get(code) ||
        { code, name: info.name || code, count: 0 }

      entry.count += 1
      counts.set(code, entry)
    }

    const detected = [...counts.values()].sort((first, second) =>
      second.count - first.count || first.code.localeCompare(second.code))

    if (keepOnlyCountrySelect) {
      const previous = keepOnlyCountrySelect.value

      // An empty picker is a dead end: nothing to choose and no hint why.
      // Countries are only known once they have been resolved, and only IPv4
      // addresses can be resolved at all, so say which of those applies.
      if (detected.length === 0) {
        const reasonKey = proxies.length === 0
          ? 'countryPickerNoProxies'
          : 'countryPickerNotDetected'

        keepOnlyCountrySelect.innerHTML =
          `<option value="">${escapeHtml(i18nGetMessage(reasonKey))}</option>`
        keepOnlyCountrySelect.disabled = true
      } else {
        keepOnlyCountrySelect.disabled = false
        keepOnlyCountrySelect.innerHTML = detected
          .map(({ code, name, count }) => {
            const flag = countryFlagEmoji(code)
            const label = `${flag ? `${flag} ` : ''}${code} — ${name} (${count})`

            return `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`
          })
          .join('')
        if (previous && counts.has(previous)) {
          keepOnlyCountrySelect.value = previous
        }
      }
    }

    if (keepOnlyCountryButton) {
      keepOnlyCountryButton.disabled = detected.length === 0
    }

    if (detectedCountriesList) {
      detectedCountriesList.innerHTML = detected
        .map(({ code, name, count }) =>
          `<option value="${escapeHtml(code)}">${escapeHtml(`${name} (${count})`)}</option>`)
        .join('')
    }

    if (countryFilterSummary) {
      const unknown = proxies.length - detected.reduce(
        (total, entry) => total + entry.count, 0,
      )

      countryFilterSummary.textContent = proxies.length === 0
        ? ''
        : `${detected.length} · ${i18nGetMessage('countryUnknownShort')}: ${unknown}`
    }
  }

  // Resolves the country of every proxy whose address hasn't been looked up
  // yet. This is the "know the country before scanning" step.
  const detectCountries = async () => {
    if (checkController) {
      return
    }

    if (detectCountriesButton) {
      detectCountriesButton.disabled = true
    }
    setCountryDetectStatus(i18nGetMessage('detectingCountriesLabel'))

    try {
      const summary = await ProxyManager.detectProxyCountries(null, {
        onProgress: (done, total) => {
          setCountryDetectStatus(
            `${i18nGetMessage('detectingCountriesLabel')} ${done}/${total}`,
          )
        },
      })

      await renderCustomProxies()
      await renderDetectedCountries()
      setCountryDetectStatus(
        `${i18nGetMessage('countriesDetectedLabel')}: ${summary.countries.length} · ` +
        `${i18nGetMessage('countryUnknownShort')}: ${summary.unknown}`,
      )
    } catch (error) {
      setCountryDetectStatus(i18nGetMessage('countryDetectionFailed'))
      console.error(`Country detection failed: ${error}`)
    } finally {
      if (detectCountriesButton) {
        detectCountriesButton.disabled = false
      }
    }
  }

  refreshCountryPicker = renderDetectedCountries

  if (detectCountriesButton) {
    detectCountriesButton.addEventListener('click', detectCountries)
  }

  const persistCountryFilter = async () => {
    await ProxyManager.setCountryFilterSettings({
      mode: countryFilterMode ? countryFilterMode.value : undefined,
      countries: countryFilterListInput
        ? countryFilterListInput.value
        : undefined,
      auto: countryFilterAuto ? countryFilterAuto.checked : undefined,
      removeUnknown: countryFilterUnknown
        ? countryFilterUnknown.checked
        : undefined,
    })
  }

  // Runs the stored filter over the whole list and reports what went away.
  const runCountryFilter = async (action, { confirmKey } = {}) => {
    if (checkController) {
      return
    }

    if (confirmKey && !window.confirm(i18nGetMessage(confirmKey))) {
      return
    }

    setCountryDetectStatus(i18nGetMessage('detectingCountriesLabel'))

    try {
      const { removed, kept, unknown } = await action({
        onProgress: (done, total) => {
          setCountryDetectStatus(
            `${i18nGetMessage('detectingCountriesLabel')} ${done}/${total}`,
          )
        },
      })

      await ProxyManager.restoreProxy()
      await renderCustomProxies()
      await renderDetectedCountries()
      setCountryDetectStatus(
        `${i18nGetMessage('countryFilterRemovedLabel')}: ${removed} · ` +
        `${i18nGetMessage('countryFilterKeptLabel')}: ${kept} · ` +
        `${i18nGetMessage('countryUnknownShort')}: ${unknown}`,
      )
    } catch (error) {
      setCountryDetectStatus(i18nGetMessage('countryDetectionFailed'))
      console.error(`Country filter failed: ${error}`)
    }
  }

  if (applyCountryFilterButton) {
    applyCountryFilterButton.addEventListener('click', async () => {
      await persistCountryFilter()

      const { mode, countries } = await ProxyManager.getCountryFilterSettings()

      if (mode === 'off' || countries.length === 0) {
        setCountryDetectStatus(i18nGetMessage('countryFilterNotConfigured'))
        return
      }

      await runCountryFilter(
        (options) => ProxyManager.applyCountryFilter(null, options),
        { confirmKey: 'countryFilterConfirm' },
      )
    })
  }

  // "I only need proxies from this country" — keeps the picked country and
  // removes everything else in one go.
  if (keepOnlyCountryButton && keepOnlyCountrySelect) {
    keepOnlyCountryButton.addEventListener('click', async () => {
      const code = keepOnlyCountrySelect.value

      if (!code) {
        setCountryDetectStatus(i18nGetMessage('countryFilterNotConfigured'))
        return
      }

      await runCountryFilter(
        (options) => ProxyManager.keepOnlyCountries(code, {
          ...options,
          removeUnknown: countryFilterUnknown
            ? countryFilterUnknown.checked
            : true,
        }),
        { confirmKey: 'keepOnlyCountryConfirm' },
      )
    })
  }

  // Restore the stored filter into the controls, then keep them in sync.
  {
    const filter = await ProxyManager.getCountryFilterSettings()

    if (countryFilterMode) {
      countryFilterMode.value = filter.mode
      countryFilterMode.addEventListener('change', persistCountryFilter)
    }
    if (countryFilterListInput) {
      countryFilterListInput.value = filter.countries.join(', ')
      countryFilterListInput.addEventListener('change', persistCountryFilter)
    }
    if (countryFilterAuto) {
      countryFilterAuto.checked = filter.auto
      countryFilterAuto.addEventListener('change', persistCountryFilter)
    }
    if (countryFilterUnknown) {
      countryFilterUnknown.checked = filter.removeUnknown
      countryFilterUnknown.addEventListener('change', persistCountryFilter)
    }
  }

  await renderDetectedCountries()

  // Remember which cloud endpoint to probe against.
  if (proxyTestTargetSelect) {
    proxyTestTargetSelect.value = await ProxyManager.getProxyTestTarget()
    proxyTestTargetSelect.addEventListener('change', async () => {
      await ProxyManager.setProxyTestTarget(proxyTestTargetSelect.value)
    })
  }

  // Imports proxies from pasted/typed text: adds the new ones, tests them
  // live and (optionally) removes the dead ones.
  const importProxiesFromText = async (text) => {
    const parsed = parseProxyList(text)

    if (parsed.length === 0) {
      showImportMsg(i18nGetMessage('noProxiesInClipboard'))
      return
    }

    let added = await ProxyManager.addCustomProxies(parsed)

    await renderCustomProxies()

    if (added.length === 0) {
      showImportMsg(i18nGetMessage('noProxiesInClipboard'))
      return
    }

    // Apply the country pre-filter to the freshly imported batch before any of
    // it is tested, so unwanted countries are never probed.
    const countryFilter = await ProxyManager.getCountryFilterSettings()
    let filteredOut = 0

    if (countryFilter.auto && countryFilter.mode !== 'off') {
      const { removedIds } = await ProxyManager.applyCountryFilter(added, {
        settings: countryFilter,
      })
      const dropped = new Set(removedIds)

      filteredOut = removedIds.length
      added = added.filter((proxy) => !dropped.has(proxy.id))

      if (filteredOut > 0) {
        await renderCustomProxies()
        await renderDetectedCountries()
      }
    }

    if (added.length === 0) {
      showImportMsg(
        `${i18nGetMessage('countryFilterRemovedLabel')}: ${filteredOut}`,
      )
      return
    }

    for (const proxy of added) {
      setRowChecking(proxy.id)
    }

    proxyTestingInProgress = true
    let results

    try {
      results = await ProxyManager.testProxies(added, {
        onResult: (id, status) => setRowStatus(id, status),
      })
    } finally {
      proxyTestingInProgress = false
    }
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
    if (filteredOut > 0) {
      summary += `  ${i18nGetMessage('countryFilterRemovedLabel')}: ${filteredOut}`
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

  // Copy the whole user list to the clipboard in the shareable format.
  if (copyAllProxiesButton) {
    copyAllProxiesButton.addEventListener('click', async () => {
      const proxies = await ProxyManager.getCustomProxies()
      const text = proxies
        .map((proxy) => formatProxyForShare(proxy))
        .filter(Boolean)
        .join('\n')

      if (text && await copyToClipboard(text)) {
        showImportMsg(i18nGetMessage('proxyCopied'))
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

  // Warns that nothing is being proxied: the domain list is empty and
  // proxy-all mode is off, so every request goes DIRECT by design.
  const refreshEmptyRegistryHint = async () => {
    if (!emptyRegistryHint) {
      return
    }

    const empty = await Registry.isEmpty()
    const proxyAll = await ProxyManager.getProxyAllTraffic()

    emptyRegistryHint.hidden = !empty || proxyAll
  }

  // "Proxy ALL traffic" toggle: reroutes everything (except local/private
  // destinations) through the selected proxies, not only blocked websites.
  if (proxyAllTrafficCheckbox) {
    proxyAllTrafficCheckbox.checked = await ProxyManager.getProxyAllTraffic()
    proxyAllTrafficCheckbox.addEventListener('change', async () => {
      await ProxyManager.setProxyAllTraffic(proxyAllTrafficCheckbox.checked)

      if (await ProxyManager.isEnabled()) {
        await ProxyManager.setProxy()
      }
      await refreshEmptyRegistryHint()
    })
  }
  await refreshEmptyRegistryHint()

  // Reads the source controls into a settings payload (without `enabled`).
  const readSourcesControls = () => ({
    sources: proxySourcesListTextarea
      ? proxySourcesListTextarea.value.split('\n')
      : undefined,
    intervalMinutes: proxySourcesIntervalInput
      ? Number(proxySourcesIntervalInput.value)
      : undefined,
    useProxy: proxySourcesUseProxyCheckbox
      ? proxySourcesUseProxyCheckbox.checked
      : undefined,
    autoTest: proxySourcesAutoTestCheckbox
      ? proxySourcesAutoTestCheckbox.checked
      : undefined,
  })

  // Auto-fetch proxy lists from sources on a timer.
  if (proxySourcesEnabledCheckbox) {
    const sourcesSettings = await ProxyManager.getProxySourcesSettings()

    proxySourcesEnabledCheckbox.checked = sourcesSettings.enabled
    if (proxySourcesListTextarea) {
      proxySourcesListTextarea.value = sourcesSettings.sources.join('\n')
    }
    if (proxySourcesIntervalInput) {
      proxySourcesIntervalInput.value = sourcesSettings.intervalMinutes
    }
    if (proxySourcesUseProxyCheckbox) {
      proxySourcesUseProxyCheckbox.checked = sourcesSettings.useProxy
    }
    if (proxySourcesAutoTestCheckbox) {
      proxySourcesAutoTestCheckbox.checked = sourcesSettings.autoTest
    }

    const persistSources = async () => {
      await ProxyManager.setProxySourcesSettings({
        ...readSourcesControls(),
        enabled: proxySourcesEnabledCheckbox.checked,
      })
    }

    for (const element of [
      proxySourcesEnabledCheckbox,
      proxySourcesListTextarea,
      proxySourcesIntervalInput,
      proxySourcesUseProxyCheckbox,
      proxySourcesAutoTestCheckbox,
    ]) {
      if (element) {
        element.addEventListener('change', persistSources)
      }
    }
  }

  // "Fetch now": save the current source controls, then fetch immediately
  // (even when the scheduled auto-fetch toggle is off).
  if (fetchProxySourcesButton) {
    fetchProxySourcesButton.addEventListener('click', async () => {
      await ProxyManager.setProxySourcesSettings(readSourcesControls())
      fetchProxySourcesButton.disabled = true
      proxyTestingInProgress = true
      if (proxySourcesStatus) {
        proxySourcesStatus.textContent = i18nGetMessage('proxySourcesFetching')
      }
      try {
        const { added, alive, removed } =
          await ProxyManager.fetchProxySources({ force: true })

        await renderCustomProxies()
        if (proxySourcesStatus) {
          proxySourcesStatus.textContent =
            `${i18nGetMessage('proxiesImportedLabel')}: +${added}  ✓${alive}  ✗${removed}`
        }
      } finally {
        proxyTestingInProgress = false
        fetchProxySourcesButton.disabled = false
      }
    })
  }

  // Collapsible sections (proxy list + proxy sources) so long lists don't take
  // up half the screen. The open/closed state is remembered.
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

  const restoreCollapsible = async () => {
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

    apply(proxyListToggle, proxyListBody, proxyUiCollapsed.list)
    apply(proxySourcesToggle, proxySourcesBody, proxyUiCollapsed.sources)
    apply(countryFilterToggle, countryFilterBody, proxyUiCollapsed.countries)
  }

  wireCollapsible(proxyListToggle, proxyListBody, 'list')
  wireCollapsible(proxySourcesToggle, proxySourcesBody, 'sources')
  wireCollapsible(countryFilterToggle, countryFilterBody, 'countries')
  await restoreCollapsible()

  // Ready-made subscription presets: pick one and append it to the sources.
  if (proxySourcesPreset) {
    proxySourcesPreset.innerHTML = RECOMMENDED_PROXY_SOURCES
      .map((source) => `<option value="${source.url}">${source.name}</option>`)
      .join('')
  }

  if (addProxySourcePreset && proxySourcesPreset && proxySourcesListTextarea) {
    addProxySourcePreset.addEventListener('click', async () => {
      const url = proxySourcesPreset.value

      if (!url) {
        return
      }

      const current = proxySourcesListTextarea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      if (current.includes(url)) {
        if (proxySourcesStatus) {
          proxySourcesStatus.textContent = i18nGetMessage('sourceAlreadyAddedLabel')
        }
        return
      }

      current.push(url)
      proxySourcesListTextarea.value = current.join('\n')
      await ProxyManager.setProxySourcesSettings(readSourcesControls())
      if (proxySourcesStatus) {
        proxySourcesStatus.textContent = i18nGetMessage('sourceAddedLabel')
      }
    })
  }

  // Fallback: if the page is closed while a test/fetch is mid-flight, put the
  // real proxy back so browsing isn't left routed through a probe PAC.
  window.addEventListener('pagehide', () => {
    if (proxyTestingInProgress) {
      if (checkController) {
        checkController.abort()
      }
      ProxyManager.restoreProxy()
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
        credentials: parsed.credentials,
      })
      console.log(`Custom proxy updated: ${parsed.protocol} ${parsed.uri}`)
    } else {
      await ProxyManager.addCustomProxy({
        name,
        protocol: parsed.protocol,
        uri: parsed.uri,
        credentials: parsed.credentials,
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
