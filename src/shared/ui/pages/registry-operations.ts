import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import * as server from 'Background/server'

export const setRegistryEnabled = async (enabled: boolean) => {
  if (enabled) {
    await Registry.enableRegistry()
    await server.synchronize()
  } else {
    await Registry.disableRegistry()
  }
  await ProxyManager.setProxy()
}

export const setRegistryCountry = (code: string, countryName: string) =>
  server.synchronize({
    region: {
      countryName, countryCode: code === 'AUTO' ? '' : code,
    },
  })
