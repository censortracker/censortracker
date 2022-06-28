import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import * as storage from 'Background/storage'

(async () => {
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const currentOption = document.querySelector('#select-toggle')

  storage.get('currentRegionName').then(({ currentRegionName = '' }) => {
    if (currentRegionName) {
      currentOption.textContent = currentRegionName
    }
  })

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
        currentRegionCode: countryAutoDetectionEnabled ? '' : countryCode.toLowerCase(),
      })
      await Registry.sync()
      const proxyingEnabled = await ProxyManager.isEnabled()

      if (proxyingEnabled) {
        await ProxyManager.setProxy()
      }

      console.warn(`Region changed to ${countryName}`)
    })
  }
})()
