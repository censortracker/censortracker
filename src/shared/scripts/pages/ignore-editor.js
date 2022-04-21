import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'

import CodeMirror from 'codemirror'

import {
  validateArrayOfURLs,
} from '@/shared/scripts/utilities'

import Ignore from '../ignore'

(async () => {
  const ignoredHosts = await Ignore.getAll()
  const searchInput = document.getElementById('search')
  const ignoredList = document.getElementById('ignoreList')

  const content = ignoredHosts.join('\n')
  const editor = CodeMirror.fromTextArea(
    ignoredList, {
      lineNumbers: true,
      lineWrapping: true,
      mode: 'text/x-mysql',
      styleActiveLine: true,
      styleActiveSelected: true,
      disableSpellcheck: true,
    },
  )

  editor.setValue(content)

  document.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey && event.key === 's') || event.keyCode === 13) {
      const naughtyUrls = editor.getValue().split('\n')
      const urls = validateArrayOfURLs(naughtyUrls)

      for (const url of urls) {
        await Ignore.add(url)
      }

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
