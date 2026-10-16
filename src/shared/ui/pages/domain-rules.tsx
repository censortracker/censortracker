import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { removeDuplicates } from 'Background/hostname'
import { getMessage } from 'Background/i18n'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../components/button'
import button from '../components/button.module.scss'
import { UploadIcon } from '../components/icons'
import { SettingsHeader, SettingsLayout } from '../components/layout'
import { useAction } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
import styles from '../styles/options.module.scss'
import type { DomainEditorHandle } from './domain-rules/domain-editor'
import { DomainEditor } from './domain-rules/domain-editor'
import { DomainImport } from './domain-rules/domain-import'
import upload from './domain-rules/domain-import.module.scss'

const readDomains = async (ignored: boolean) => ignored
  ? removeDuplicates((await browser.storage.local.get({
    ignoredHosts: [],
  })).ignoredHosts)
  : (await browser.storage.local.get({
    customProxiedDomains: [],
  })).customProxiedDomains

export const DomainRulesPage = ({ ignored = false }: { ignored?: boolean }) => {
  useKeySequence()
  const editor = useRef<DomainEditorHandle | null>(null)
  const [dialog, setDialog] = useState(false)
  const [saved, setSaved] = useState(false)
  const [changed, setChanged] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const { busy, error, run } = useAction()

  usePageError(error)
  useEffect(() => {
    let active = true

    run(async () => {
      const domains = await readDomains(ignored)

      if (active) {
        editor.current?.setValue(domains.join('\n'))
      }
    })
    return () => {
      active = false
      clearTimeout(timer.current)
    }
  }, [ignored, run])
  const save = () => run(async () => {
    const domains = await callBackground('saveDomains', {
      ignored,
      domains: (editor.current?.getValue() || '').trim().split('\n'),
    })

    editor.current?.setValue(domains.join('\n'))
    setChanged(true)
    setSaved(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 500)
  })

  return <SettingsLayout linkedImage
    imageLinkClass={ignored ? styles['return-link'] : undefined}
    after={!ignored && <DomainImport
      open={dialog} onClose={() => setDialog(false)} editor={editor} />}>
    <SettingsHeader title={ignored ? 'ignoredSitesTitle' : 'proxiedWebsitesEditorPageTitle'} />
    <div class={styles['main-page__about']}>
      {getMessage(ignored ? 'ignoredSitesDesc' : 'proxiedWebsitesEditorPageDesc')}
    </div>
    <div class={styles['main-page__search']}>
      <input type="text" class={styles['input-search']} id="search"
        placeholder={getMessage('searchPlaceholder')}
        aria-label={getMessage('searchPlaceholder')}
        onInput={(event) =>
          editor.current?.highlight(event.currentTarget.value)} />
      {!ignored && <button type="button" id="loadDomains"
        class={`${upload.btn__add_list} ${button.plain}`}
        onClick={() => setDialog(true)}>
        <UploadIcon />{' '}<span>{getMessage('optionsLoadFromSource')}</span>
      </button>}
    </div>
    <DomainEditor editor={editor} />
    <Button id="saveChanges" class={styles['save-changes']} disabled={busy} onClick={save}>
      {changed ? getMessage(saved ? 'optionsSavedMessage' : 'saveChanges')
        : <span class={styles.btn__text}>{getMessage('saveChanges')}</span>}
    </Button>
  </SettingsLayout>
}

export const proxied: PageView = {
  component: () => <DomainRulesPage />,
  bodyClass: `${styles.document} ${upload.proxied}`,
}
export const ignored: PageView = {
  component: () => <DomainRulesPage ignored />,
  bodyClass: styles.document ?? '',
}
