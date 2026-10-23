import { callBackground } from 'Background/background-rpc'
import { removeDuplicates } from 'Background/hostname'
import { getMessage } from 'Background/i18n'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import button from '../../components/button.module.scss'
import { detach } from '../../hooks/async'
import { useEscape } from '../../hooks/escape'
import settings from '../../styles/options.module.scss'
import type { DomainEditorRef } from './domain-editor'
import styles from './domain-import.module.scss'

const readLines = (text: string) => removeDuplicates(text.split('\n')
  .map((line) => line.trim()).filter((line) => line.length > 0))

export const DomainImport = ({ open, onClose, editor }: {
  open: boolean
  onClose: () => void
  editor: DomainEditorRef
}) => {
  const [source, setSource] = useState('')
  const [urlError, setUrlError] = useState('')
  const [fileError, setFileError] = useState('')
  const revision = useRef(0)
  const close = () => {
    revision.current++
    onClose()
    setUrlError('')
    setFileError('')
  }

  useEscape(open, close)
  useLayoutEffect(() => () => {
    revision.current++
  }, [])
  const update = (domains: string[], ticket: number) => {
    const all = removeDuplicates([...readLines(editor.current?.getValue() || ''), ...domains])

    if (ticket !== revision.current) {
      return true
    }
    if (all.length > 1000) {
      return false
    }
    editor.current?.setValue(`${all.join('\n')}\n`)
    editor.current?.focusEnd()
    onClose()
    return true
  }
  const download = async () => {
    const ticket = ++revision.current

    try {
      const text = await callBackground('downloadDomains', source)

      if (ticket !== revision.current) {
        return
      }
      const domains = readLines(text ?? '')

      if (text === null) {
        setUrlError('invalidURLError')
      } else if (domains.length === 0) {
        setUrlError('fetchURLError')
      } else if (!update(domains, ticket)) {
        setUrlError('maxDomainsExceededError')
      }
    } catch {
      if (ticket === revision.current) {
        setUrlError('fetchURLError')
      }
    }
  }
  const upload = async (file?: File) => {
    const ticket = ++revision.current

    if (!file) {
      return
    }
    if (file.size > 64000) {
      setFileError('fileSizeError')
      return
    }
    const domains = readLines(await file.text())

    if (ticket !== revision.current) {
      return
    }
    if (domains.length === 0) {
      setFileError('emptyFileError')
    } else if (!update(domains, ticket)) {
      setFileError('maxDomainsExceededError')
    }
  }

  return <div class={styles.popup_upload_list} hidden={!open} id="popup"
    role="dialog" aria-modal="true" aria-labelledby="popupTitle">
    <div class={styles.popup_upload_list__wrapper}>
      <div id="popupTitle"
        class={`${settings['main-page__title']} ${settings['page-main-title']}`}>
        {getMessage('popupLoadFromSourceTitle')}
      </div>
      <div class={styles.popup__text}>{getMessage('popupDesc')}</div>
      <div class={styles.popup_upload_form}>
        <div class={styles.upload_form__url}>
          <div class={styles['upload_form__url-item']}>
            <input type="text" class={styles['input-url-list']} id="sourceURL"
              placeholder="URL" value={source}
              onInput={(event) => setSource(event.currentTarget.value)} />
            <button type="button" class={settings.btn} id="loadFromURLButton"
              onClick={() => detach(download())}>
              <span class={settings.btn__text}>{getMessage('popupLoadButton')}</span>
            </button>
          </div>
          <div id="urlSourceError" hidden={!urlError} class={styles.upload_form__error}>
            {getMessage(urlError)}
          </div>
        </div>
        <div class={styles.or}>{getMessage('popupOr')}</div>
        <div class={styles.upload_form__file}>
          <div class={styles['file-upload']}>
            <input id="textFileInput" accept="text/plain" type="file"
              onChange={(event) =>
                detach(upload(event.currentTarget.files?.[0]))} />
            <label for="textFileInput" class={`${settings.btn} ${styles.btn_upload_file}`}>
              {getMessage('chooseFileOnComputer')}
            </label>
          </div>
          <div id="textFileReadError" hidden={!fileError} class={styles.upload_form__error}>
            {getMessage(fileError)}
          </div>
        </div>
      </div>
    </div>
    <button type="button" class={`${styles.close_btn} ${button.plain}`} id="closePopup"
      aria-label={getMessage('close')} onClick={close}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L25 25M25 1L1 25" stroke="#3B332B" stroke-opacity="0.5" stroke-width="2" />
      </svg>
    </button>
  </div>
}
