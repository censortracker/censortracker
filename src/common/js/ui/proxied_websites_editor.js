import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'

import CodeMirror from 'codemirror'

import storage from '../storage'
import { translateDocument } from './ui'

(async () => {
  translateDocument(document)
  const searchInput = document.getElementById('search')
  const domainsList = document.getElementById('domainsList')
  const { customProxiedDomains } = await storage.get({ customProxiedDomains: [] })

  const content = customProxiedDomains.join('\n')
  const editor = CodeMirror.fromTextArea(
    domainsList, {
      lineNumbers: true,
      lineWrapping: true,
      mode: 'text/x-mysql',
      styleActiveLine: true,
      styleActiveSelected: true,
      disableSpellcheck: true,
    },
  )

  editor.setValue(content)
  editor.setOption('extraKeys', {
    Enter: (instance) => {
      return CodeMirror.Pass
    },
    'Ctrl-S': (instance) => {
      return CodeMirror.Pass
    },
  })

  searchInput.addEventListener('input', () => {
    // Returns an array containing all marked ranges in the document.
    for (const marker of editor.getAllMarks()) {
      marker.clear()
    }

    const value = searchInput.value
    const cursor = editor.getSearchCursor(value)

    while (cursor.findNext()) {
      // Mark a range of text with a specific CSS class name.
      editor.markText(
        cursor.from(),
        cursor.to(),
        {
          className: 'highlight',
        },
      )
    }
  })
})()
