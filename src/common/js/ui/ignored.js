import CodeMirror from 'codemirror/src/codemirror'

let ignoredListEditor = 'app.slack.com\nh53u3jlin.ru\nlive.browserstack.com\nm.pokupki.market.yandex.ru\nmargn.ru\ndoors.ru\npxj3re.com\nreadymag.com'
const searchInput = document.getElementById('search')
const ignoredList = document.getElementById('ignored_list')

const editor = CodeMirror.fromTextArea(ignoredList, {
  lineNumbers: true,
  lineWrapping: true,
  mode: 'text/x-mysql',
  styleActiveLine: true,
  styleActiveSelected: true,
})

editor.setValue(ignoredListEditor)

editor.on('change', (cm, change) => {
  ignoredListEditor = cm.getValue()
})

function search (val) {
  const cursor = editor.getSearchCursor(val)

  while (cursor.findNext()) {
    editor.markText(
      cursor.from(),
      cursor.to(),
      { className: 'highlight' },
    )
  }
}

searchInput.addEventListener('input', () => {
  const markers = editor.getAllMarks()

  markers.forEach((marker) => marker.clear())

  const value = searchInput.value

  search(value)
})
