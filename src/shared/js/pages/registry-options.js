import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import * as server from 'Background/server'
import * as storage from 'Background/storage'

(async () => {
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const selectRegion = document.querySelector('#selectRegion')
  const currentOption = document.querySelector('#select-toggle')
  const useRegistryCheckbox = document.querySelector('#useRegistryCheckbox')

  storage.get({ useRegistry: false, currentRegionName: '' })
    .then(({ useRegistry, currentRegionName }) => {
      if (useRegistry) {
        selectRegion.classList.remove('hidden')
      }
      useRegistryCheckbox.checked = useRegistry
      if (currentRegionName) {
        currentOption.textContent = currentRegionName
      }
    })

  useRegistryCheckbox.addEventListener('change', async (event) => {
    const useRegistry = event.target.checked
    const proxyingEnabled = await ProxyManager.isEnabled()

    if (useRegistry) {
      selectRegion.classList.remove('hidden')
      await Registry.enableRegistry()
      await server.synchronize()
      await ProxyManager.setProxy()
    } else {
      selectRegion.classList.add('hidden')
      await Registry.clearRegistry()
      await Registry.disableRegistry()
      await storage.set({ currentRegionName: '' })

      if (proxyingEnabled) {
        await ProxyManager.setProxy()
      }
    }

    await storage.set({ useRegistry })
  }, false)

  document.addEventListener('click', (event) => {
    if (event.target.id === 'select-toggle') {
      select.classList.toggle('show-countries')
    }

    if (!event.target.closest('.select')) {
      for (const element of document.querySelectorAll('.show-countries')) {
        element.classList.remove('show-countries')
      }
    }
  })

  for (const option of options) {
    option.addEventListener('click', async (event) => {
      select.classList.remove('show-countries')

      const countryCode = event.target.dataset.value
      const countryName = event.target.textContent
      const countryAutoDetectionEnabled = countryCode.toUpperCase().includes('AUTO')

      currentOption.value = countryCode
      currentOption.textContent = countryName
      currentOption.dataset.i18nKey = `country${countryCode}`

      await storage.set({
        currentRegionName: countryName,
        currentRegionCode: countryAutoDetectionEnabled ? '' : countryCode.toUpperCase(),
      })
      await server.sync()
      const proxyingEnabled = await ProxyManager.isEnabled()

      if (proxyingEnabled) {
        await ProxyManager.setProxy()
      }

      console.warn(`Region changed to ${countryName}`)
    })
  }
})()
