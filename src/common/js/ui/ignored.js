import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'

import CodeMirror from 'codemirror'

(async () => {
  let ignoredListEditor = ['app.slack.com', 'rutracker.org', 'api.telegram.org'].join('\n')

  const searchInput = document.getElementById('search')
  const ignoredList = document.getElementById('ignoreList')

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
  editor.on('change', (instance, _changeObj) => {
    ignoredListEditor = instance.getValue(0)
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
