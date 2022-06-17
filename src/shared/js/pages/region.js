import Registry from 'Background/registry'
import { translateDocument } from 'Background/utilities'
import Browser from 'Background/webextension'

(async () => {
  const { countryDetails: { name: country } } = await Registry.getConfig()

  translateDocument(document, { country })

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.select')) {
      document.querySelectorAll('.select_show')
        .forEach((select) => {
          select.classList.remove('select_show')
        })
    }
  })

  const availableCountries = document.getElementById('availableCountries')

  for (const { name, isoA2Code } of []) {
    const li = document.createElement('li')

    try {
      li.innerText = Browser.i18n.getMessage(`countryName${isoA2Code}`)
    } catch (error) {
      li.innerText = name
    }

    li.classList.add('select-option')
    li.setAttribute('data-select', 'option')
    li.setAttribute('data-value', isoA2Code)
    li.setAttribute('data-index', 1)

    availableCountries.append(li)
  }

  const CLASS_NAME_SELECTED = 'option-selected'
  const SELECTOR_OPTION_SELECTED = '.option-selected'
  const SELECTOR_DATA_TOGGLE = '[data-select="toggle"]'
  const dropdown = document.getElementById('select-toggle')

  const selected = document.querySelector(SELECTOR_OPTION_SELECTED)
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const elToggle = document.querySelector(SELECTOR_DATA_TOGGLE)

  dropdown.addEventListener('click', (event) => {
    select.classList.toggle('select_show')
  })

  options.forEach((item, i) => {
    item.addEventListener('click', (event) => {
      if (item.classList.contains(CLASS_NAME_SELECTED)) {
        return
      }
      update(item)
      hide()
    })
  })

  function update (option) {
    options.forEach((item, i) => {
      item.classList.remove(CLASS_NAME_SELECTED)
    })

    option = option.closest('.select-option')
    if (selected) {
      selected.classList.remove(CLASS_NAME_SELECTED)
    }
    option.classList.add(CLASS_NAME_SELECTED)
    elToggle.textContent = option.textContent
    elToggle.value = option.dataset.value
    elToggle.dataset.index = option.dataset.index

    return option.dataset.value
  }

  function hide () {
    select.classList.remove('select_show')
  }
})()
