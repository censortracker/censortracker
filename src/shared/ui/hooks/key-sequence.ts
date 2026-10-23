import browser from 'Background/browser-api'
import { useLayoutEffect } from 'preact/hooks'

import { useLatest } from './async'

export const useKeySequence = (
  complete: () => unknown = () => browser.tabs.create({
    url: browser.runtime.getURL('animation.html'),
  })) => {
  const callback = useLatest(complete)

  useLayoutEffect(() => {
    const sequence = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown',
      'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']
    let index = 0
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }
      const target = event.target

      if (target instanceof HTMLElement &&
        (target.closest('input, textarea, select') || target.isContentEditable)) {
        index = 0
        return
      }
      index = event.key.toLowerCase() === sequence[index] ? index + 1 : 0
      if (index === sequence.length) {
        index = 0
        callback.current()
      }
    }

    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [callback])
}
