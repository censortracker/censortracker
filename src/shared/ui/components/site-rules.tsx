import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import { useRef, useState } from 'preact/hooks'

import { useAction, useResource } from '../hooks/async'
import styles from '../styles/options.module.scss'
import { Button } from './button'
import { Field, SettingsSection } from './form'

export const SiteRules = () => {
  const { value, refresh } = useResource(() =>
    browser.storage.local.get({ siteCountryRules: {} }))
  const [host, setHost] = useState('')
  const [countries, setCountries] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const { busy, error, run } = useAction()
  const names = new Intl.DisplayNames([getUILanguage()], { type: 'region' })
  const save = (hostname: string, codes: string[] | null) => run(async () => {
    try {
      await callBackground('siteCountryRule', { host: hostname, countries: codes })
      setHost('')
      setCountries('')
    } finally {
      await refresh()
    }
  })

  return <SettingsSection class={`${styles.option} ${styles['settings-section']}`}
    id="siteRuleOptions" title="siteRulesTitle">
    <p class={styles['main-page__about']}>{getMessage('siteRulesHelp')}</p>
    <form id="siteRuleForm" onSubmit={(event) => {
      event.preventDefault()
      save(host.trim(), countries.toUpperCase().split(/[\s,]+/).filter(Boolean))
    }}>
      <Field id="siteRuleHost" title="siteRuleHost">
        <input id="siteRuleHost" ref={input} class={styles['input-proxy']}
          required maxLength={4096} placeholder="example.com" disabled={busy}
          value={host}
          onInput={(event) => setHost(event.currentTarget.value)} />
      </Field>
      <Field id="siteRuleCountries" title="siteRuleCountries">
        <input id="siteRuleCountries" class={styles['input-proxy']} maxLength={2028}
          placeholder="RU, CN" disabled={busy} value={countries}
          onInput={(event) => setCountries(event.currentTarget.value)} />
      </Field>
      <div class={styles['settings-actions']}>
        <Button type="submit" id="siteRuleSave" disabled={busy || !value}>
          {getMessage('saveCustomProxyButton')}
        </Button>
      </div>
    </form>
    <p id="siteRuleError" role="alert" hidden={!error}>{getMessage('siteRuleError')}</p>
    <ul id="siteRuleRows" class={styles['settings-list']}>
      {Object.entries(value?.siteCountryRules || {}).map(([hostname, codes]) =>
        <li key={hostname}>
          <span>{`${hostname}: ${codes.length > 0
            ? codes.map((code) => `${names.of(code)} (${code})`).join(', ')
            : getMessage('siteRuleUnrestricted')} `}</span>
          <button type="button" disabled={busy} onClick={() => {
            setHost(hostname)
            setCountries(codes.join(', '))
            input.current?.focus()
          }}>{getMessage('proxyEdit')}</button>
          <button type="button" disabled={busy} onClick={() => save(hostname, null)}>
            {getMessage('proxyDelete')}
          </button>
        </li>)}
    </ul>
  </SettingsSection>
}
