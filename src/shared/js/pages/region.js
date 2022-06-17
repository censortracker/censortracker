import Registry from 'Background/registry'
import { translateDocument } from 'Background/utilities'

(async () => {
  const { countryDetails: { name: country } } = await Registry.getConfig()

  translateDocument(document, { country })

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.select')) {
      document.querySelectorAll('.select-show')
        .forEach((select) => {
          select.classList.remove('select-show')
        })
    }
  })

  const CLASS_NAME_SELECTED = 'option-selected'
  const SELECTOR_OPTION_SELECTED = '.option-selected'
  const SELECTOR_DATA_TOGGLE = '[data-select="toggle"]'
  const dropdown = document.getElementById('select-toggle')

  const selected = document.querySelector(SELECTOR_OPTION_SELECTED)
  const select = document.querySelector('.select')
  const options = document.querySelectorAll('.select-option')
  const elToggle = document.querySelector(SELECTOR_DATA_TOGGLE)

  dropdown.addEventListener('click', (event) => {
    select.classList.toggle('select-show')
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
    select.classList.remove('select-show')
  }
})()
