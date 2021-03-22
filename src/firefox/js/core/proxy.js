import { storage } from '.'

const PROXY_GATE_URL = 'https://163.172.211.183:39263'

class Proxy {
  getProxyInfo = () => {
    return {
      type: 'https',
      host: 'proxy-ssl.roskomsvoboda.org',
      port: 33333,
    }
  }

  getDirectProxyInfo = () => {
    return { type: 'direct' }
  }

  enableProxy = async () => {
    console.warn('Proxying enabled.')
    await storage.set({
      useProxy: true,
    })
  }

  disableProxy = async () => {
    console.warn('Proxying disabled.')
    await storage.set({
      useProxy: false,
    })
  }

  allowProxying = () => {
    const request = new XMLHttpRequest()

    request.open('GET', PROXY_GATE_URL, true)
    request.addEventListener('error', (_error) => {
      console.warn('Error on opening port')
    })
    request.send(null)
  }
}

export default new Proxy()
