import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/display/autorefresh'
import 'codemirror/lib/codemirror.css'

import Browser from 'Background/browser-api'
import Ignore from 'Background/ignore'
import { i18nGetMessage, removeDuplicates } from 'Background/utilities'
import CodeMirror from 'codemirror'

(async () => {
  const search = document.getElementById('search')
  const textarea = document.getElementById('textarea')
  const saveChangesButton = document.getElementById('saveChanges')
  const isIgnorePage = textarea.dataset.type === 'ignoredDomains'
  const editor = CodeMirror.fromTextArea(
    textarea, {
      autorefresh: true,
      lineNumbers: true,
      lineWrapping: true,
      mode: 'text/x-mysql',
      styleActiveLine: true,
      styleActiveSelected: true,
      disableSpellcheck: true,
    },
  )

  search.addEventListener('input', () => {
    for (const marker of editor.getAllMarks()) {
      marker.clear()
    }

    const value = search.value
    const cursor = editor.getSearchCursor(value)

    while (cursor.findNext()) {
      editor.markText(
        cursor.from(),
        cursor.to(),
        {
          className: 'highlight',
        },
      )
    }
  })

  saveChangesButton.addEventListener('click', async (event) => {
    const button = event.target
    const editorContent = editor.getValue().trim()
    const urls = editorContent.split('\n')
    const validUrls = removeDuplicates(urls)

    button.textContent = i18nGetMessage('optionsSavedMessage')

    setTimeout(() => {
      button.textContent = i18nGetMessage('saveChanges')
    }, 500)

    if (isIgnorePage) {
      await Ignore.set(validUrls)
    } else {
      await Browser.storage.local.set({
        customProxiedDomains: validUrls,
      })
    }
    editor.setValue(validUrls.join('\n'))
  })

  if (isIgnorePage) {
    Ignore.getAll().then((ignoredHosts) => {
      editor.setValue(ignoredHosts.join('\n'))
    })
  } else {
    Browser.storage.local.get({ customProxiedDomains: [] })
      .then(({ customProxiedDomains }) => {
        editor.setValue(customProxiedDomains.join('\n'))
      })
  }
})()
