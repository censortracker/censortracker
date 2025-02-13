const radioButtons = document.querySelectorAll('input[name="proxy-radio"]')
const blockLocalProxy = document.querySelector('.block_custom-local-proxy')
const btnaddLocalProxy = document.querySelector('.btn__addLocalProxy')

function toggleElements (event) {
  const isChecked = event.target.checked && event.target.id === 'useLocalProxy'

  if (isChecked) {
    blockLocalProxy.style.display = 'block'
    btnaddLocalProxy.style.display = 'inline-flex'
  } else {
    blockLocalProxy.style.display = 'none'
    btnaddLocalProxy.style.display = 'none'
  }
}

radioButtons.forEach((radio) => {
  radio.addEventListener('change', toggleElements)
})

toggleElements({ target: document.getElementById('useLocalProxy') })
// показывать/скрывать блок для своего локального прокси - начало

// аккордион для блоков с группой proxy - начало
document.querySelectorAll('.proxy-list__block-title').forEach((header) => {
  header.addEventListener('click', function () {
    const content = this.nextElementSibling

    document.querySelectorAll('.proxy-list__block-items').forEach((item) => {
      if (item !== content) {
        item.style.maxHeight = null
        item.previousElementSibling.classList.remove('active')
      }
    })

    if (content.style.maxHeight) {
      content.style.maxHeight = null
      this.classList.remove('active')
    } else {
      content.style.maxHeight = `${content.scrollHeight}px`
      this.classList.add('active')
    }
  })
})
// аккордион для блоков с группой proxy  - конец

// подсказки к выбранным proxy  - начало
document.addEventListener('DOMContentLoaded', () => {
  const radioButtons = document.querySelectorAll('.radio-button-input')

  function updateSelection () {
    document.querySelectorAll('.proxy-list__block-title span').forEach((span) => span.remove())
    document.querySelectorAll('.radio-button-label span').forEach((span) => span.remove())
    radioButtons.forEach((radio) => {
      if (radio.name === 'local-proxy' && radio.checked) {
        const label = document.querySelector(`label[for="${radio.id}"]`)

        if (label) {
          const statusSpan = document.createElement('span')

          statusSpan.textContent = 'Подключено'
          label.append(statusSpan)
        }

        const block = radio.closest('.proxy-list__block')

        if (block) {
          const title = block.querySelector('.proxy-list__block-title')

          if (title) {
            const chosenSpan = document.createElement('span')

            chosenSpan.textContent = 'Выбран'
            title.append(chosenSpan)
          }
        }
      }
    })
  }

  radioButtons.forEach((radio) => {
    radio.addEventListener('change', updateSelection)
  })

  updateSelection()
})
// подсказки к выбранным proxy  - конец

// меню кнопок - начало
function toggleMenu (event, button) {
  event.stopPropagation()
  const menu = document.getElementById('proxy-list__block-item__menu')
  const isActive = menu.classList.contains('active')

  document.querySelectorAll('.proxy-list__block-item__btn').forEach((b) => b.classList.remove('active'))

  if (!isActive) {
    const rect = button.getBoundingClientRect()

    menu.style.top = `${window.scrollY + rect.bottom}px`
    menu.classList.add('active')
    menu.style.left = `${window.scrollX + rect.right - menu.offsetWidth}px`
    button.classList.add('active')
  } else {
    menu.classList.remove('active')
  }
}

document.addEventListener('click', () => {
  document.getElementById('proxy-list__block-item__menu').classList.remove('active')
  document.querySelectorAll('.proxy-list__block-item__btn').forEach((b) => b.classList.remove('active'))
})
// меню кнопок - конец

// открыть попапы - начало
function openPopup (popupId) {
  const popup = document.getElementById(popupId)

  if (popup) {
    popup.style.display = 'block'
  }
}

// закрыть попапы - начало

// закрывать попап - начало
function closePopup (event) {
  const popup = event.target.closest('.proxy-list__block__popup')

  if (popup) {
    popup.querySelectorAll('input, textarea').forEach((field) => {
      field.value = ''
    })
    popup.style.display = 'none'
  }
}

// закрывать попап - конец
