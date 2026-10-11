import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import Ignore from 'Background/ignore'
import { removeDuplicates } from 'Background/utilities'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../components/button'
import type { DomainEditorHandle } from '../components/domain-editor'
import { DomainEditor } from '../components/domain-editor'
import { DomainImport } from '../components/domain-import'
import { UploadIcon } from '../components/icons'
import { SettingsHeader, SettingsLayout } from '../components/layout'
import { useKeySequence } from '../hooks/key-sequence'
import upload from '../styles/domain-import.module.scss'
import styles from '../styles/options.module.scss'

export const DomainRulesPage = ({ ignored = false }: { ignored?: boolean }) => {
  useKeySequence()
  const editor = useRef<DomainEditorHandle | null>(null)
  const [dialog, setDialog] = useState(false)
  const [saved, setSaved] = useState(false)
  const [changed, setChanged] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let active = true
    const read = async () => {
      const domains = ignored ? await Ignore.getAll()
        : (await browser.storage.local.get({
          customProxiedDomains: [],
        })).customProxiedDomains

      if (active) {
        editor.current?.setValue(domains.join('\n'))
      }
    }

    read()
    return () => {
      active = false
      clearTimeout(timer.current)
    }
  }, [])
  const save = async () => {
    const domains = removeDuplicates((editor.current?.getValue() || '').trim().split('\n'))

    if (ignored) {
      await Ignore.set(domains)
    } else {
      await browser.storage.local.set({ customProxiedDomains: domains })
    }
    editor.current?.setValue(domains.join('\n'))
    setChanged(true)
    setSaved(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 500)
  }

  return <SettingsLayout linkedImage
    imageLinkClass={ignored ? styles['return-link'] : undefined}
    after={!ignored && <DomainImport
      open={dialog} onClose={() => setDialog(false)} editor={editor} />}>
    <SettingsHeader title={ignored ? 'ignoredSitesTitle' : 'proxiedWebsitesEditorPageTitle'} />
    <div class={styles['main-page__about']}>
      {getMessage(ignored ? 'ignoredSitesDesc' : 'proxiedWebsitesEditorPageDesc')}
    </div>
    <div class={styles['main-page__search']}>
      <input type="text" class={styles['input-search']} id="search" placeholder="Search..."
        onInput={(event) =>
          editor.current?.highlight(event.currentTarget.value)} />
      {!ignored && <div class={upload.btn__add_list} id="loadDomains"
        onClick={() => setDialog(true)}>
        <UploadIcon />{' '}<span>{getMessage('optionsLoadFromSource')}</span>
      </div>}
    </div>
    <DomainEditor editor={editor} ignored={ignored} />
    <Button id="saveChanges" onClick={save}>
      {changed ? getMessage(saved ? 'optionsSavedMessage' : 'saveChanges')
        : <span class={styles.btn__text}>{getMessage('saveChanges')}</span>}
    </Button>
  </SettingsLayout>
}
