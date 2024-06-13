import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/display/autorefresh'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/ayu-mirage.css'

import CodeMirror from 'codemirror'

import { i18nGetMessage, isValidURL, removeDuplicates } from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg } from './messaging'

(async () => {
  const source = 'rules-editor'
  const search = document.getElementById('search')
  const textarea = document.getElementById('textarea')
  const saveChangesButton = document.getElementById('saveChanges')
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)')

  const editor = CodeMirror.fromTextArea(
    textarea, {
      autorefresh: true,
      lineNumbers: true,
      lineWrapping: true,
      mode: 'text/x-mysql',
      styleActiveLine: true,
      styleActiveSelected: true,
      disableSpellcheck: true,
      theme: prefersDarkScheme.matches ? 'ayu-mirage' : 'default',
    },
  )

  // Handle switching between dark and light mode.
  prefersDarkScheme.addEventListener('change', (event) => {
    editor.setOption('theme', event.matches ? 'ayu-mirage' : 'default')
  })

  // Handle search highlighting.
  search.addEventListener('input', () => {
    for (const marker of editor.getAllMarks()) {
      marker.clear()
    }

    const cursor = editor.getSearchCursor(search.value)

    if (cursor.findNext()) {
      editor.markText(
        cursor.from(),
        cursor.to(),
        {
          className: 'highlight',
        },
      )
      editor.setCursor(cursor.from())
    }
  })

  // Check whether the page is the ignored domains page.
  const isIgnorePage = textarea.dataset.type === 'ignoredDomains'

  saveChangesButton.addEventListener('click', async (event) => {
    const editorContent = editor.getValue().trim()
    const urls = editorContent.split('\n')
    const domains = removeDuplicates(urls)

    if (isIgnorePage) {
      await sendExtensionCallMsg(source, 'setIgnoredDomains', { domains })
    } else {
      await sendExtensionCallMsg(source, 'setCustomProxiedDomains', { domains })
    }
    editor.setValue(domains.join('\n'))
    event.target.textContent = i18nGetMessage('optionsSavedMessage')

    // Reset the button text after 500ms.
    setTimeout(() => {
      event.target.textContent = i18nGetMessage('saveChanges')
    }, 500)
  })

  if (isIgnorePage) {
    sendExtensionCallMsg(source, 'getIgnoredDomains').then((ignoredHosts) => {
      editor.setValue(ignoredHosts.join('\n'))
    })
  } else {
    sendConfigFetchMsg('customProxiedDomains')
      .then(({ customProxiedDomains }) => {
        editor.setValue(customProxiedDomains.join('\n'))
      })
  }

  const popup = document.getElementById('popup')

  if (popup) {
    const loadDomainsButton = document.getElementById('loadDomains')
    const closePopupButton = document.getElementById('closePopup')
    const textFileInput = document.getElementById('textFileInput')
    const textFileReadError = document.getElementById('textFileReadError')
    const loadFromURLButton = document.getElementById('loadFromURLButton')
    const urlSourceError = document.getElementById('urlSourceError')

    const maxSizeBytes = 64000 // 64KB
    const maxDomainsAllowed = 1000

    const updateEditorContent = async (domains) => {
      const { customProxiedDomains } =
        await sendConfigFetchMsg('customProxiedDomains')
      const domainsArray = [...customProxiedDomains, ...domains]

      if (domainsArray.length > maxDomainsAllowed) {
        return false
      }

      const editorContent = domainsArray.join('\n')

      editor.setValue(`${editorContent}\n`)
      editor.focus()
      editor.setCursor({ line: domainsArray.length + 1, ch: 1 })

      // Hide popup.
      popup.classList.add('hidden')
      return true
    }

    loadFromURLButton.addEventListener('click', async (event) => {
      const sourceURL = document.getElementById('sourceURL').value

      if (isValidURL(sourceURL)) {
        fetch(sourceURL)
          .then((response) => response.text())
          .then(async (text) => {
            const domains = readlines(text)

            if (domains.length === 0) {
              urlSourceError.textContent = i18nGetMessage('fetchURLError')
              urlSourceError.classList.remove('hidden')
              return
            }

            updateEditorContent(domains)
              .then((updated) => {
                if (!updated) {
                  urlSourceError.textContent = i18nGetMessage('maxDomainsExceededError')
                  urlSourceError.classList.remove('hidden')
                }
              })
          }).catch((_error) => {
            urlSourceError.textContent = i18nGetMessage('fetchURLError')
            urlSourceError.classList.remove('hidden')
          })
      } else {
        urlSourceError.textContent = i18nGetMessage('invalidURLError')
        urlSourceError.classList.remove('hidden')
      }
    })

    textFileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0]
      const fileReader = new FileReader()

      // The file is too large.
      if (file && file.size > maxSizeBytes) {
        textFileReadError.textContent = i18nGetMessage('fileSizeError')
        textFileReadError.classList.remove('hidden')
        return
      }

      fileReader.addEventListener('load', async (e) => {
        const domains = readlines(e.target.result)

        // Show an error if the file is empty.
        if (domains.length === 0) {
          textFileReadError.textContent = i18nGetMessage('emptyFileError')
          textFileReadError.classList.remove('hidden')
          return
        }
        updateEditorContent(domains)
          .then((updated) => {
            if (!updated) {
              textFileReadError.textContent = i18nGetMessage('maxDomainsExceededError')
              textFileReadError.classList.remove('hidden')
            }
          })
      })
      fileReader.readAsText(file)
    })

    // Show the popup when the button is clicked.
    loadDomainsButton.addEventListener('click', async (event) => {
      popup.classList.remove('hidden')
    })

    // Hide the popup when the button is clicked.
    closePopupButton.addEventListener('click', async (event) => {
      popup.classList.add('hidden')
      urlSourceError.classList.add('hidden')
      textFileReadError.classList.add('hidden')
    })
  }

  /**
   * Read the contents of a file and return an array of domains.
   * @param contents The contents of the file.
   * @returns {*} An array of domains.
   */
  const readlines = (contents) => {
    const domains = contents.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length !== 0)

    return removeDuplicates(domains)
  }
})()
