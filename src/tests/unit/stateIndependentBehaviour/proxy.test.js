import ProxyManager from '../../../shared/js/extension/base/proxy'
import * as mockedStorage from '../../env/mockedStorage/dataAccess'

test('default setting proxy', async () => {
  const proxyData = await ProxyManager.setProxy()

  expect(proxyData).toBe(true)
})

test('setting proxy with empty registry', async () => {
  await mockedStorage.set({ domains: [] })
  const proxyData = await ProxyManager.setProxy()

  expect(proxyData).toBe(false)
})
