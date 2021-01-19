class Proxy {
  constructor () {
    this.ignoredDomains = [
      '^youtu.be',
      '^youtube.com',
      'deviantart.com',
    ]
    this.ignoreRegEx = new RegExp(
      this.ignoredDomains.join('|'), 'gi')

    setInterval(async () => {
      await this.removeOutdatedBlockedDomains()
    }, 60 * 1000 * 60 * 60 * 2)
  }

  excludeIgnoredDomains = (domains) => {
    return domains.filter((domain) => {
      return !domain.match(this.ignoreRegEx)
    })
  }

  removeProxy = async () => {
    await browser.storage.local.set({ useProxyChecked: false })
    console.warn('Proxy auto-config data cleaned!')
  }

  allowProxying = () => {
    const request = new XMLHttpRequest()
    const proxyServerUrl = 'https://163.172.211.183:39263'

    request.open('GET', proxyServerUrl, true)
    request.addEventListener('error', (_error) => {
      console.error('Error on opening port')
    })
    request.send(null)
  }

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

  removeOutdatedBlockedDomains = async () => {
    const monthInSeconds = 2628000
    let { blockedDomains } = await browser.storage.local.get({ blockedDomains: [] })

    if (blockedDomains) {
      blockedDomains = blockedDomains.filter((item) => {
        const timestamp = new Date().getTime()

        return (timestamp - item.timestamp) / 1000 < monthInSeconds
      })
    }

    await browser.storage.local.set({ blockedDomains })
    console.warn('Outdated domains has been removed.')
  }
}

export default new Proxy()
