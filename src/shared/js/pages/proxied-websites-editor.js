import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/display/autorefresh'
import 'codemirror/lib/codemirror.css'

import Browser from 'Background/browser-api'
import { parseURLStrings } from 'Background/utilities'
import CodeMirror from 'codemirror'

(async () => {
  const searchInput = document.getElementById('search')
  const domainsList = document.getElementById('domainsList')
  const { customProxiedDomains } = await Browser.storage.local.get({
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
    if (event.keyCode === 13) {
      const urls = editor.getValue().split('\n')

      await Browser.storage.local.set({
        customProxiedDomains: parseURLStrings(urls),
      })
      console.warn('Custom proxy list updated!')
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
