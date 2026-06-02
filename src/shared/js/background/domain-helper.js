import { getDomain } from 'tldts'

import browser from './browser-api'

/**
 * Runs inside the inspected page. Collects every distinct hostname the page
 * talks to: the document itself, every already-loaded sub-resource (scripts,
 * images, XHR/fetch, fonts, media...) and every element that references an
 * external URL. This is what powers the "add related domains" helper, since
 * opening a single site often requires proxying a whole set of CDNs/APIs.
 * @returns {string[]} A list of hostnames.
 */
const pageCollector = () => {
  const hosts = new Set()

  const addFromUrl = (value) => {
    if (!value) {
      return
    }
    try {
      const { hostname } = new URL(value, window.location.href)

      if (hostname) {
        hosts.add(hostname)
      }
    } catch (error) {
      // Ignore values that aren't valid URLs.
    }
  }

  try {
    hosts.add(window.location.hostname)

    const resources = window.performance
      ? window.performance.getEntriesByType('resource')
      : []

    for (const entry of resources) {
      addFromUrl(entry.name)
    }

    for (const element of document.querySelectorAll('[src], [href], [data-src]')) {
      addFromUrl(element.getAttribute('src'))
      addFromUrl(element.getAttribute('href'))
      addFromUrl(element.getAttribute('data-src'))
    }
  } catch (error) {
    // Be defensive: never let collection throw inside the page.
  }

  return Array.from(hosts)
}

/**
 * Executes {@link pageCollector} in the given tab in a cross-browser way.
 * @param {number} tabId - Target tab id.
 * @returns {Promise<string[]>} Hostnames reported by the page (or []).
 */
const executeCollector = async (tabId) => {
  // Chromium (MV3) — chrome.scripting with a function reference.
  if (!browser.isFirefox && browser.scripting && browser.scripting.executeScript) {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: pageCollector,
      })

      if (Array.isArray(results) && results[0] && Array.isArray(results[0].result)) {
        return results[0].result
      }
    } catch (error) {
      console.error(`[DomainHelper] scripting.executeScript failed: ${error}`)
    }
    return []
  }

  // Firefox (MV2) and other engines exposing tabs.executeScript with code.
  if (browser.tabs && browser.tabs.executeScript) {
    try {
      const code = `(${pageCollector.toString()})();`
      const results = await browser.tabs.executeScript(tabId, { code })

      if (Array.isArray(results) && Array.isArray(results[0])) {
        return results[0]
      }
    } catch (error) {
      console.error(`[DomainHelper] tabs.executeScript failed: ${error}`)
    }
  }

  return []
}

/**
 * Collects the set of registrable domains a page depends on, so the user can
 * tick the ones they want to add to the proxy list.
 * @param {number} tabId - Tab to inspect.
 * @returns {Promise<string[]>} Sorted, de-duplicated registrable domains.
 */
export const collectRelatedDomains = async (tabId) => {
  const hostnames = await executeCollector(tabId)
  const domains = new Set()

  for (const hostname of hostnames) {
    const domain = getDomain(hostname)

    if (domain) {
      domains.add(domain)
    }
  }

  return Array.from(domains).sort()
}

export default { collectRelatedDomains }
