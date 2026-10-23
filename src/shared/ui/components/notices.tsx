import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useEffect } from 'preact/hooks'

import {
  detach, useAction, useLatest, useResource, useStorageChanges,
} from '../hooks/async'
import consent from '../styles/consent.module.scss'
import button from './button.module.scss'

// Pages pass their own classes, so each page loads only its own styles.
export const Notices = ({ onEmpty, classes = {} }: {
  onEmpty?: () => Promise<unknown>
  classes?: { title?: string; text?: string; button?: string }
}) => {
  const { value, error: readError, refresh } = useResource(() =>
    callBackground('notices'))
  const { busy, error, run } = useAction()
  const empty = useLatest(onEmpty)
  const current = value?.[0]

  useEffect(() => {
    if (value?.length === 0) {
      const done = empty.current?.()

      if (done) {
        detach(done)
      }
    }
  }, [value, empty])
  useStorageChanges((changes) => {
    if (Object.keys(changes).some((key) =>
      key.startsWith('noticeActive:') || key.startsWith('noticeRead:'))) {
      detach(refresh())
    }
  })

  return <section class={consent['consent-status']} hidden={!current}
    aria-live="polite">
    <h2 class={classes.title}>{current && getMessage(current.title)}</h2>
    <p class={classes.text}>
      {current && getMessage(current.text)}
      {current?.link && <> <a class={consent['notice-link']}
        href={browser.runtime.getURL(current.link.path)} target="_blank">
        {getMessage(current.link.label)}
      </a></>}
    </p>
    <button type="button"
      class={`${classes.button} ${button.btn} ${button['btn-dark']}`}
      disabled={busy} onClick={() => current && run(
        () => callBackground('dismissNotice', current.id), refresh,
      )}>{getMessage('noticeOkay')}</button>
    <p role="alert">{error || readError ? getMessage('operationFailed') : ''}</p>
  </section>
}
