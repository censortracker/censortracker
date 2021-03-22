import 'codemirror/addon/search/search'
import 'codemirror/addon/search/matchesonscrollbar'
import 'codemirror/addon/search/searchcursor'

import CodeMirror from 'codemirror'

import storage from '../storage'

(async () => {
  const searchInput = document.getElementById('search')
  const ignoredList = document.getElementById('ignoreList')
  const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

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

  const getValidatedContent = (instance) => {
    return instance
      .getValue()
      .split('\n')
      .filter((e) => e !== '')
  }

  // Set the editor content.
  editor.setValue(content)
  editor.setOption('extraKeys', {
    Enter: (instance) => {
      storage.set({ ignoredHosts: getValidatedContent(instance) })
      return CodeMirror.Pass
    },
    Backspace: (instance) => {
      storage.set({ ignoredHosts: getValidatedContent(instance) })
      return CodeMirror.Pass
    },
  })

  searchInput.addEventListener('input', () => {
    // Returns an array containing all marked ranges in the document.
    editor.getAllMarks().forEach((marker) => marker.clear())

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
