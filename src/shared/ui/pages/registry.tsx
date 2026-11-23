import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { defaultRegistryUpdateInterval, registryUpdateIntervals } from 'Background/registry-update-data'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../components/button'
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
  registryUpdateInterval: defaultRegistryUpdateInterval,
  currentRegionName: '',
  currentRegionCode: '',
  registryRegionCode: '',
}

const Dropdown = ({ id, labelId, text, selected, options, onSelect }: {
  id: string
  labelId: string
  text: string
  selected: string
  options: { value: string; label: string }[]
  onSelect: (value: string) => void
}) => {
  const [expanded, setExpanded] = useState(false)
  const select = useRef<HTMLDivElement>(null)
  const choose = (value: string) => {
    setExpanded(false)
    onSelect(value)
  }

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

  return <div ref={select} class={`${selectStyles.select} ${expanded ? selectStyles['show-countries'] : ''}`}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        setExpanded(false)
      }
    }}>
    <button type="button" class={selectStyles['select-toggle']} id={id}
      aria-haspopup="listbox" aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}>{text}</button>
    <div class={selectStyles['select-dropdown']}>
      <ul class={selectStyles['select-options']} role="listbox"
        aria-labelledby={labelId}>
        {options.map(({ value, label }) =>
          <li class={selectStyles['select-option']} data-value={value} key={value}
            role="option" aria-selected={value === selected}
            tabIndex={expanded ? 0 : -1} onClick={() => choose(value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose(value)
              }
            }}>{label}</li>)}
      </ul>
    </div>
  </div>
}

export const RegistryPage = () => {
  useKeySequence()
  const { value, error: readError, refresh } = useResource(
    () => browser.storage.local.get(regionDefaults),
    Object.keys(regionDefaults),
  )
  const { busy, error, run } = useAction()
  const code = value?.currentRegionCode || value?.registryRegionCode
  const country = value?.currentRegionName
    ? getMessage(`country${code}`) || value.currentRegionName
    : getMessage('countryAUTO')
  const interval = String(
    value?.registryUpdateInterval ?? defaultRegistryUpdateInterval,
  )
  const intervals = registryUpdateIntervals.map((minutes) => ({
    value: String(minutes), label: getMessage(`registryUpdateInterval${minutes}`),
  }))

  usePageError(error || readError)
  const chooseRegion = (region: string) => run(() => callBackground('synchronize', {
    region: {
      countryName: getMessage(`country${region}`),
      countryCode: region === 'AUTO' ? '' : region,
    },
  }), refresh)
  const chooseInterval = (minutes: string) => run(
    () => callBackground('setRegistryUpdateInterval', Number(minutes)), refresh,
  )

  return <SettingsLayout linkedImage>
    <SettingsHeader title="optionsRegistryTitle" />
    <div class={styles.checkbox__group}>
      <Toggle id="useRegistryCheckbox" title="useRegistry" checked={value?.useRegistry ?? false}
        onChange={(checked) => run(() => callBackground('setRegistryEnabled', checked), refresh)} />
      <div class={styles['main-page__about']}>
        <div class={styles.use_proxy__text}>{getMessage('useRegistryDesc')}</div>
      </div>
    </div>
    <div id="registryUpdateInterval" class={styles['select-region']} hidden={!value?.useRegistry}>
      <div class={styles.option__title} id="registryUpdateIntervalTitle">
        {getMessage('registryUpdateIntervalTitle')}
      </div>
      <div class={styles.description}>{getMessage('registryUpdateIntervalDesc')}</div>
      <Dropdown id="registryUpdateToggle" labelId="registryUpdateIntervalTitle"
        text={intervals.find((option) => option.value === interval)?.label ?? ''}
        selected={interval} options={intervals} onSelect={chooseInterval} />
      <div class={styles['settings-actions']}>
        <Button id="downloadRegistryNow" disabled={busy}
          onClick={() => run(() => callBackground('updateRegistry'), refresh)}>
          {getMessage('registryDownloadNow')}
        </Button>
      </div>
    </div>
    <div id="selectRegion" class={styles['select-region']} hidden={!value?.useRegistry}>
      <div class={styles.option__title} id="selectRegionTitle">{getMessage('registrySelectRegionTitle')}</div>
      <div class={styles.description}>{getMessage('registrySelectRegionDesc')}</div>
      <Dropdown id="select-toggle" labelId="selectRegionTitle" text={country}
        selected={code || 'AUTO'} onSelect={chooseRegion}
        options={regions.map((region) => ({
          value: region, label: getMessage(`country${region}`),
        }))} />
    </div>
    <RegistryStatus />
    <RegistrySource />
  </SettingsLayout>
}

export const page: PageView = {
  component: RegistryPage, bodyClass: settingsDocument,
}
