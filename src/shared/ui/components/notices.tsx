import browser from 'Background/browser-api'
import { dismissNotice, pendingNotices } from 'Background/extension-notices'
import { getMessage } from 'Background/i18n'
import { useEffect } from 'preact/hooks'

import { useAction, useLatest, useResource, useStorageChanges } from '../hooks/async'
import consent from '../styles/consent.module.scss'
import settings from '../styles/options.module.scss'
import popup from '../styles/popup.module.scss'

export const Notices = ({ onEmpty, compact = false }: {
  onEmpty?: () => Promise<unknown>
  compact?: boolean
}) => {
  const { value, error: readError, refresh } = useResource(pendingNotices)
  const { busy, error, run } = useAction()
  const empty = useLatest(onEmpty)
  const current = value?.[0]
  const styles = compact ? popup : settings

  useEffect(() => {
    if (value?.length === 0) {
      empty.current?.()
    }
  }, [value])
  useStorageChanges((changes) => {
    if (Object.keys(changes).some((key) =>
      key.startsWith('noticeActive:') || key.startsWith('noticeRead:'))) {
      refresh()
    }
  })

  return <section class={consent['consent-status']} hidden={!current}
    aria-live="polite">
    <h2 class={styles.block__title}>
      {current && getMessage(current.title)}
    </h2>
    <p class={styles.disclaimer__text}>
      {current && getMessage(current.text)}
      {current?.link && <> <a class={consent['notice-link']}
        href={browser.runtime.getURL(current.link.path)} target="_blank">
        {getMessage(current.link.label)}
      </a></>}
    </p>
    <button type="button"
      class={`${styles['default-btn']} ${settings.btn} ${settings['btn-dark']}`}
      disabled={busy} onClick={() => run(async () => {
        if (current) {
          await dismissNotice(current.id)
          await refresh()
        }
      })}>{getMessage('noticeOkay')}</button>
    <p role="alert">{error || readError ? getMessage('operationFailed') : ''}</p>
  </section>
}
