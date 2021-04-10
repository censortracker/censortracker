import { storage } from '.'

const PROXY_TYPE = 'https'
const PROXY_HOST = 'proxy-ssl.roskomsvoboda.org'
const PROXY_PORT = 33333

const PROXY_GATE_URL = 'https://163.172.211.183:39263'

class Proxy {
  getProxyInfo = () => {
    return {
      type: PROXY_TYPE,
      host: PROXY_HOST,
      port: PROXY_PORT,
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
