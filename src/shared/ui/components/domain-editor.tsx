import type { RefObject } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

import { createDomainEditor } from './domain-editor-view'

export type DomainEditorHandle = ReturnType<typeof createDomainEditor>

export const DomainEditor = ({ editor, ignored }: {
  editor: RefObject<DomainEditorHandle | null>
  ignored: boolean
}) => {
  const textarea = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const instance = createDomainEditor(textarea.current!)

    editor.current = instance
    return () => {
      instance.destroy()
      editor.current = null
    }
  }, [])
  return <textarea id="textarea" ref={textarea}
    data-type={ignored ? 'ignoredDomains' : 'proxiedDomains'} />
}
