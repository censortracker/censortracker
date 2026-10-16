import {
  defaultKeymap, history, historyKeymap, indentMore, indentSelection, insertTab,
} from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import {
  Compartment, EditorState, StateEffect, StateField,
} from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import {
  Decoration, drawSelection, EditorView, highlightSpecialChars, keymap,
  lineNumbers,
} from '@codemirror/view'

const highlightEffect = StateEffect.define<DecorationSet>()
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (marks, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(highlightEffect)) {
        return effect.value
      }
    }
    return marks.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const createDomainEditor = (textarea: HTMLTextAreaElement) => {
  const theme = new Compartment()
  const scheme = window.matchMedia('(prefers-color-scheme: dark)')
  const getTheme = () => EditorView.theme({}, { dark: scheme.matches })
  const editor = new EditorView({
    doc: textarea.value,
    extensions: [
      lineNumbers(),
      drawSelection(),
      highlightSpecialChars(),
      EditorState.allowMultipleSelections.of(true),
      EditorState.tabSize.of(4),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'false' }),
      history(),
      keymap.of([
        ...defaultKeymap, ...historyKeymap, ...searchKeymap,
        {
          key: 'Tab',
          run: (view) => view.state.selection.ranges.some(
            (range) => !range.empty,
          )
            ? indentMore(view) : insertTab(view),
          shift: indentSelection,
        },
      ]),
      highlightField,
      theme.of(getTheme()),
    ],
  })

  textarea.hidden = true
  textarea.after(editor.dom)
  const updateTheme = () => {
    editor.dispatch({ effects: theme.reconfigure(getTheme()) })
  }

  scheme.addEventListener('change', updateTheme)

  return {
    destroy: () => {
      scheme.removeEventListener('change', updateTheme)
      editor.destroy()
    },
    getValue: () => editor.state.doc.toString(),
    setValue: (value: string) => editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      selection: { anchor: 0 },
      effects: highlightEffect.of(Decoration.none),
    }),
    focusEnd: () => {
      editor.dispatch({
        selection: { anchor: editor.state.doc.length }, scrollIntoView: true,
      })
      editor.focus()
    },
    highlight: (query: string) => {
      const from = query ? editor.state.doc.toString().indexOf(query) : -1
      const marks = from === -1 ? Decoration.none : Decoration.set([
        Decoration.mark({ class: 'highlight' }).range(from, from + query.length),
      ])

      editor.dispatch({
        effects: highlightEffect.of(marks),
        ...(from === -1 ? {} : { selection: { anchor: from } }),
        scrollIntoView: from !== -1,
      })
    },
  }
}
