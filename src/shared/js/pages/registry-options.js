import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'registry-oprtions'
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const selectRegion = document.querySelector('#selectRegion')
  const currentOption = document.querySelector('#select-toggle')
  const useRegistryCheckbox = document.querySelector('#useRegistryCheckbox')

  sendConfigFetchMsg(
    'useRegistry',
    'currentRegionName',
  ).then(({ useRegistry, currentRegionName }) => {
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

    if (useRegistry) {
      selectRegion.classList.remove('hidden')
      sendExtensionCallMsg(source, 'enableRegistry')
    } else {
      selectRegion.classList.add('hidden')
      sendExtensionCallMsg(source, 'disableRegistry')
    }
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

      sendExtensionCallMsg(source, 'setCountry', {
        currentRegionName: countryName,
        currentRegionCode: countryAutoDetectionEnabled ? '' : countryCode.toUpperCase(),
      })
      sendTransitionMsg('updateRegistry')
      console.warn(`Region changed to ${countryName}`)
    })
  }
})()
