const PROXY_GATE_URL = 'https://163.172.211.183:39263'

class Proxy {
  constructor () {
    this.ignoredDomains = [
      '^youtu.be',
      '^youtube.com',
      'deviantart.com',
    ]
    this.ignoreRegEx = new RegExp(
      this.ignoredDomains.join('|'), 'gi')
  }

  getProxyInfo = () => {
    return {
      type: 'https',
      host: 'proxy-ssl.roskomsvoboda.org',
      port: 33333,
    }
  }

  excludeIgnoredDomains = (domains) => {
    return domains.filter((domain) => {
      return !domain.match(this.ignoreRegEx)
    })
  }

  enableProxy = async () => {
    await browser.storage.local.set({
      useProxyChecked: true,
    })
  }

  disableProxy = async () => {
    await browser.storage.local.set({
      useProxyChecked: false,
    })
  }

  allowProxying = () => {
    const request = new XMLHttpRequest()

    request.open('GET', PROXY_GATE_URL, true)
    request.addEventListener('error', (_error) => {
      console.error('Error on opening port')
    })
    request.send(null)
  }

  // TODO: Remove these methods
  controlledByOtherExtensions = async () => {
    const { levelOfControl } =
      await browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  controlledByThisExtension = async () => {
    const { levelOfControl } =
      await browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }
}

export default new Proxy()
