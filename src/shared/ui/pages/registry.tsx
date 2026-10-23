import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Toggle } from '../components/form'
import { settingsDocument, SettingsHeader, SettingsLayout } from '../components/layout'
import { RegistryStatus } from '../components/registry-status'
import selectStyles from '../components/select.module.scss'
import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
import styles from '../styles/options.module.scss'
import { RegistrySource } from './registry/registry-source'

const regions = ['AUTO', 'RU', 'BY', 'UA', 'AZ', 'KZ', 'KG', 'UZ']
const regionDefaults = {
  useRegistry: false,
  currentRegionName: '',
  currentRegionCode: '',
  registryRegionCode: '',
}

export const RegistryPage = () => {
  useKeySequence()
  const { value, error: readError, refresh } = useResource(
    () => browser.storage.local.get(regionDefaults),
    Object.keys(regionDefaults),
  )
  const { error, run } = useAction()
  const [expanded, setExpanded] = useState(false)
  const select = useRef<HTMLDivElement>(null)
  const code = value?.currentRegionCode || value?.registryRegionCode
  const country = value?.currentRegionName
    ? getMessage(`country${code}`) || value.currentRegionName
    : getMessage('countryAUTO')

  usePageError(error || readError)
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
  const choose = (region: string) => {
    setExpanded(false)
    run(() => callBackground('synchronize', {
      region: {
        countryName: getMessage(`country${region}`),
        countryCode: region === 'AUTO' ? '' : region,
      },
    }), refresh)
  }

  return <SettingsLayout linkedImage>
    <SettingsHeader title="optionsRegistryTitle" />
    <div class={styles.checkbox__group}>
      <Toggle id="useRegistryCheckbox" title="useRegistry" checked={value?.useRegistry ?? false}
        onChange={(checked) => run(() => callBackground('setRegistryEnabled', checked), refresh)} />
      <div class={styles['main-page__about']}>
        <div class={styles.use_proxy__text}>{getMessage('useRegistryDesc')}</div>
      </div>
    </div>
    <div id="selectRegion" class={styles['select-region']} hidden={!value?.useRegistry}>
      <div class={styles.option__title} id="selectRegionTitle">{getMessage('registrySelectRegionTitle')}</div>
      <div class={styles.description}>{getMessage('registrySelectRegionDesc')}</div>
      <div ref={select} class={`${selectStyles.select} ${expanded ? selectStyles['show-countries'] : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setExpanded(false)
          }
        }}>
        <button type="button" class={selectStyles['select-toggle']} id="select-toggle"
          aria-haspopup="listbox" aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}>{country}</button>
        <div class={selectStyles['select-dropdown']}>
          <ul class={selectStyles['select-options']} role="listbox"
            aria-labelledby="selectRegionTitle">
            {regions.map((region) =>
              <li class={selectStyles['select-option']} data-value={region} key={region}
                role="option" aria-selected={region === (code || 'AUTO')}
                tabIndex={expanded ? 0 : -1} onClick={() => choose(region)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    choose(region)
                  }
                }}>{getMessage(`country${region}`)}</li>)}
          </ul>
        </div>
      </div>
    </div>
    <RegistryStatus />
    <RegistrySource />
  </SettingsLayout>
}

export const page: PageView = {
  component: RegistryPage, bodyClass: settingsDocument,
}
