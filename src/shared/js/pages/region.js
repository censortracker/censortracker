(async () => {
  const select = document.querySelector('.select')
  const dropdown = document.getElementById('select-toggle')
  const selectedOption = document.querySelector('.option-selected')
  const options = document.querySelectorAll('.select-option')
  const currentOption = document.querySelector('[data-select="toggle"]')

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

  for (const option of options) {
    option.addEventListener('click', (event) => {
      if (!option.classList.contains('option-selected')) {
        options.forEach((item) => {
          item.classList.remove('option-selected')
        })

        if (selectedOption) {
          selectedOption.classList.remove('option-selected')
        }

        const thisOption = option.closest('.select-option')

        thisOption.classList.add('option-selected')
        currentOption.value = option.dataset.value
        currentOption.textContent = option.textContent
        currentOption.dataset.index = option.dataset.index
        select.classList.remove('select-show')
      }
    })
  }
})()
