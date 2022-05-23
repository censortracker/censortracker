import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/display/autorefresh'
import 'codemirror/lib/codemirror.css'

import * as storage from 'Background/storage'
import { translateDocument, validateUrls } from 'Background/utilities'
import CodeMirror from 'codemirror'

(async () => {
  translateDocument(document)
  const searchInput = document.getElementById('search')
  const domainsList = document.getElementById('domainsList')
  const { customProxiedDomains } = await storage.get({
    customProxiedDomains: [],
  })

  const content = customProxiedDomains.join('\n')
  const editor = CodeMirror.fromTextArea(domainsList, {
    autorefresh: true,
    lineNumbers: true,
    lineWrapping: true,
    mode: 'text/x-mysql',
    styleActiveLine: true,
    styleActiveSelected: true,
    disableSpellcheck: true,
  })

  editor.setValue(content)

  document.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey && event.key === 's') || event.keyCode === 13) {
      const urls = editor.getValue().split('\n')

      await storage.set({
        customProxiedDomains: validateUrls(urls),
      })
      console.warn('Ignore list updated')
      event.preventDefault()
    }
  })

  searchInput.addEventListener('input', () => {
    // Returns an array containing all marked ranges in the document.
    for (const marker of editor.getAllMarks()) {
      marker.clear()
    }

    const value = searchInput.value
    const cursor = editor.getSearchCursor(value)

    console.log(`Searching for: ${value}...`)

    while (cursor.findNext()) {
      // Mark a range of text with a specific CSS class name.
      editor.markText(cursor.from(), cursor.to(), {
        className: 'highlight',
      })
    }
  })
})()
