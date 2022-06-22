import * as storage from 'Background/storage'

(async () => {
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const currentOption = document.querySelector('#select-toggle')

  const { currentRegionName } = await storage.get(['currentRegionName'])

  if (currentRegionName) {
    currentOption.textContent = currentRegionName
  }

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
      if (!event.target.classList.contains('option-selected')) {
        const countryCode = event.target.dataset.value
        const countryName = event.target.textContent

        currentOption.value = countryCode
        currentOption.textContent = countryName
        currentOption.dataset.i18nKey = `country${countryCode}`

        await storage.set({ currentRegionName: countryName })

        select.classList.remove('show-countries')
      }
    })
  }
})()
