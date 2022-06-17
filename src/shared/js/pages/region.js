(async () => {
  const select = document.querySelector('.select')
  const dropdown = document.getElementById('select-toggle')
  const selected = document.querySelector('.option-selected')
  const options = document.querySelectorAll('.select-option')
  const elToggle = document.querySelector('[data-select="toggle"]')

  dropdown.addEventListener('click', (event) => {
    select.classList.toggle('select-show')
  })

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.select')) {
      for (const element of document.querySelectorAll('.select-show')) {
        element.classList.remove('select-show')
      }
    }
  })

  options.forEach((item, i) => {
    item.addEventListener('click', (event) => {
      if (item.classList.contains('option-selected')) {
        return
      }
      update(item)
      hide()
    })
  })

  function update (option) {
    options.forEach((item, i) => {
      item.classList.remove('option-selected')
    })

    option = option.closest('.select-option')
    if (selected) {
      selected.classList.remove('option-selected')
    }
    option.classList.add('option-selected')
    elToggle.value = option.dataset.value
    elToggle.textContent = option.textContent
    elToggle.dataset.index = option.dataset.index

    return option.dataset.value
  }

  function hide () {
    select.classList.remove('select-show')
  }
})()
