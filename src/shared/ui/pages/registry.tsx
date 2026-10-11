import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Toggle } from '../components/form'
import { SettingsHeader, SettingsLayout } from '../components/layout'
import { RegistrySource } from '../components/registry-source'
import { RegistryStatus } from '../components/registry-status'
import { useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import styles from '../styles/options.module.scss'
import { setRegistryCountry, setRegistryEnabled } from './registry-operations'

export const RegistryPage = () => {
  useKeySequence()
  const { value, error } = useResource(() => browser.storage.local.get({
    useRegistry: false, currentRegionName: '', currentRegionCode: '', registryRegionCode: '',
  }))

  usePageError(error)
  const [enabled, setEnabled] = useState(false)
  const [country, setCountry] = useState(getMessage('countryAUTO'))
  const [expanded, setExpanded] = useState(false)
  const select = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      setEnabled(value.useRegistry)
      if (value.currentRegionName) {
        setCountry(getMessage(`country${value.currentRegionCode || value.registryRegionCode}`) ||
          value.currentRegionName)
      }
    }
  }, [value])
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node &&
        !select.current?.contains(event.target)) {
        setExpanded(false)
      }
    }

    document.addEventListener('click', outside)
    return () => document.removeEventListener('click', outside)
  }, [])
  const toggle = async (checked: boolean) => {
    setEnabled(checked)
    await setRegistryEnabled(checked)
  }
  const choose = async (code: string) => {
    setExpanded(false)
    const countryName = getMessage(`country${code}`)

    setCountry(countryName)
    await setRegistryCountry(code, countryName)
  }

  return <SettingsLayout linkedImage>
    <SettingsHeader title="optionsRegistryTitle" id="options-region-title" class="" />
    <div class={styles.checkbox__group}>
      <Toggle id="useRegistryCheckbox" title="useRegistry" checked={enabled} onChange={toggle} />
      <div class={styles['main-page__about']}>
        <div class={styles.use_proxy__text}>{getMessage('useRegistryDesc')}</div>
      </div>
    </div>
    <div id="selectRegion" hidden={!enabled}>
      <div class={styles.option__title}>{getMessage('registrySelectRegionTitle')}</div>
      <div class={styles.description}>{getMessage('registrySelectRegionDesc')}</div>
      <div ref={select} class={`${styles.select} ${expanded ? styles['show-countries'] : ''}`}>
        <button type="button" class={styles['select-toggle']} id="select-toggle"
          onClick={() => setExpanded(!expanded)}>{country}</button>
        <div class={styles['select-dropdown']}>
          <ul class={styles['select-options']}>
            {['AUTO', 'RU', 'BY', 'UA', 'AZ', 'KZ', 'KG', 'UZ'].map((code) =>
              <li class={styles['select-option']} data-value={code} key={code}
                onClick={() => choose(code)}>{getMessage(`country${code}`)}</li>)}
          </ul>
        </div>
      </div>
    </div>
    <RegistryStatus />
    <RegistrySource />
  </SettingsLayout>
}
