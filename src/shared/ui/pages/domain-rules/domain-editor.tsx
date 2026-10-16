import './domain-editor.scss'

import type { RefObject } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

import { createDomainEditor } from './domain-editor-view'

export type DomainEditorHandle = ReturnType<typeof createDomainEditor>
export type DomainEditorRef = RefObject<DomainEditorHandle | null>

export const DomainEditor = ({ editor }: { editor: DomainEditorRef }) => {
  const textarea = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (!textarea.current) {
      return undefined
    }
    const instance = createDomainEditor(textarea.current)

    editor.current = instance
    return () => {
      instance.destroy()
      editor.current = null
    }
  }, [editor])
  return <textarea id="textarea" ref={textarea} />
}
