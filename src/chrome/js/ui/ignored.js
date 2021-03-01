let ignoredListEditor = 'app.slack.com\nh53u3jlin.ru\nlive.browserstack.com\nm.pokupki.market.yandex.ru\nmargn.ru\ndoors.ru\npxj3re.com\nreadymag.com'

const editor = CodeMirror.fromTextArea($('#ignored_list')[0], {
  lineNumbers: true,
  lineWrapping: true,
  mode: 'text/x-mysql',
  styleActiveLine: true,
  styleActiveSelected: true,
})

editor.setValue(ignoredListEditor)

editor.on('change', function (cm, change) {
  ignoredListEditor = cm.getValue()
})

function search (val) {

  const cursor = editor.getSearchCursor(val)

  while (cursor.findNext()) {
    editor.markText(
      cursor.from(),
      cursor.to(),
      { className: 'highlight' }
    )
  }
}

$('#search').on('input', function () {
  const markers = editor.getAllMarks()

  markers.forEach(marker => marker.clear())

  const value = $('#search')[0].value

  search(value)
})
