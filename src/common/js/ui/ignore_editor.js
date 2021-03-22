import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'

import CodeMirror from 'codemirror'

import storage from '../storage'

(async () => {
  const searchInput = document.getElementById('search')
  const ignoredList = document.getElementById('ignoreList')

  const ignoredHosts = await storage.get({ ignoredHosts: [] })

  console.log(ignoredHosts)

  let ignoredListEditor = 'app.slack.com\napi.telegram.org\n'

  const editor = CodeMirror.fromTextArea(
    ignoredList, {
      // https://codemirror.net/doc/manual.html#config
      lineNumbers: true,
      lineWrapping: true,
      mode: 'text/x-mysql',
      styleActiveLine: true,
      styleActiveSelected: true,
      disableSpellcheck: false,
    },
  )

  // Set the editor content.
  editor.setValue(ignoredListEditor)

  // Fires every time the content of the editor is changed.
  editor.on('change', async (instance, _changeObj) => {
    ignoredListEditor = instance.getValue()
    console.log(_changeObj)
    console.log(instance.getValue())
  })

  const search = (val) => {
    const cursor = editor.getSearchCursor(val)

    while (cursor.findNext()) {
      // Can be used to mark a range of text with a specific CSS class name.
      editor.markText(
        cursor.from(),
        cursor.to(),
        {
          className: 'highlight',
        },
      )
    }
  }

  searchInput.addEventListener('input', () => {
    // Returns an array containing all marked ranges in the document.
    const markers = editor.getAllMarks()

    markers.forEach((marker) => marker.clear())

    const value = searchInput.value

    search(value)
  })
})()
