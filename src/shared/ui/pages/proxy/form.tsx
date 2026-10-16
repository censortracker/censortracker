import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { parseProxyAddress } from 'Background/proxy-address'
import type { ProxyListAction } from 'Background/proxy-list'
import type { ManagedProxy } from 'Background/proxy-record'
import { hasProxyAuth } from 'Background/proxy-record'
import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../../components/button'
import { Field, SettingsSection } from '../../components/form'
import styles from '../../styles/options.module.scss'
import type { ProxyProtocol } from './protocol-options'
import { isProxyProtocol, ProtocolSelect } from './protocol-options'

interface Draft {
  name: string
  address: string
  protocol: ProxyProtocol
  username: string
  password: string
  unrestricted: boolean
}

const readDraft = (editing?: ManagedProxy): Draft => ({
  name: editing?.name || '',
  address: editing?.host ? `${editing.host}:${editing.port}` : '',
  protocol: editing && isProxyProtocol(editing.protocol) ? editing.protocol : 'HTTPS',
  username: editing?.username || '',
  password: editing?.password || '',
  unrestricted: !editing?.restricted,
})

// The list gives each edit a new key, so the draft starts from `editing`.
export const ProxyForm = ({ editing, busy, save, cancel, invalid }: {
  editing?: ManagedProxy
  busy: boolean
  save: (action: ProxyListAction) => void
  cancel: () => void
  invalid: () => void
}) => {
  const [draft, setDraft] = useState(() => readDraft(editing))
  const [auth, setAuth] =
    useState(() => Boolean(editing && hasProxyAuth(editing)))
  const address = useRef<HTMLInputElement>(null)
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }))

  useLayoutEffect(() => {
    if (editing) {
      address.current?.focus()
    }
  }, [editing])

  return <form id="proxyForm" class={`${styles['settings-section']} ${styles['proxy-form']}`} aria-labelledby="proxyFormTitle"
    onSubmit={(event) => {
      event.preventDefault()
      try {
        const endpoint = parseProxyAddress(draft.address.trim())

        save({
          operation: 'save',
          proxy: {
            id: editing?.id,
            name: draft.name.trim() || undefined,
            protocol: draft.protocol,
            username: draft.username,
            password: draft.password,
            restricted: !draft.unrestricted,
            ...endpoint,
          },
        })
      } catch {
        invalid()
      }
    }}>
    <h2 id="proxyFormTitle">{getMessage(editing ? 'proxyEditTitle' : 'proxyAdd')}</h2>
    <Field id="proxyName" title="proxyNameOptional">
      <input id="proxyName" type="text" maxLength={100} class={styles['input-proxy']}
        disabled={busy} value={draft.name}
        onInput={(event) => update('name', event.currentTarget.value)} />
    </Field>
    <div class={styles['settings-grid']}>
      <Field id="select-toggle" title="proxyProtocol">
        <ProtocolSelect id="select-toggle" disabled={busy} value={draft.protocol}
          onChange={(protocol) => update('protocol', protocol)} />
      </Field>
      <Field id="proxyServerInput" title="proxyAddress">
        <input type="text" required autoComplete="off" spellcheck={false} ref={address}
          id="proxyServerInput" class={styles['input-proxy']} placeholder="hostname:port"
          disabled={busy} value={draft.address} onInput={(event) =>
            update('address', event.currentTarget.value)} />
      </Field>
    </div>
    <SettingsSection id="proxyAuthOptions" title="proxyAuthTitle" open={auth}
      onToggle={(event) => setAuth(event.currentTarget.open)}>
      <div class={styles['settings-grid']}>
        <Field id="proxyUsername" title="proxyUsername">
          <input id="proxyUsername" autoComplete="off" spellcheck={false} class={styles['input-proxy']}
            disabled={busy} value={draft.username} onInput={(event) =>
              update('username', event.currentTarget.value)} />
        </Field>
        <Field id="proxyPassword" title="proxyPassword">
          <input id="proxyPassword" type="password" autoComplete="new-password" class={styles['input-proxy']}
            disabled={busy} value={draft.password} onInput={(event) =>
              update('password', event.currentTarget.value)} />
        </Field>
      </div>
      <p class={styles['main-page__about']}>{getMessage('proxyAuthPrivacy')}</p>
      <p id="proxySocksUnsupported" class={styles['main-page__about']} hidden={browser.isFirefox}>
        {getMessage('proxySocksUnsupported')}
      </p>
    </SettingsSection>
    <label id="proxyRestriction" class={styles['settings-check']}
      hidden={!editing?.restricted || Boolean(editing?.provider)}>
      <input id="proxyUnrestricted" type="checkbox" disabled={busy} checked={draft.unrestricted}
        onChange={(event) => update('unrestricted', event.currentTarget.checked)} />
      <span>{getMessage('proxyUnrestricted')}</span>
    </label>
    <div class={styles['settings-actions']}>
      <Button type="submit" id="saveCustomProxyButton" disabled={busy}>
        <span class={styles.btn__text}>{getMessage('saveCustomProxyButton')}</span>
      </Button>
      <button type="button" id="cancelProxyEdit" hidden={!editing} disabled={busy} onClick={cancel}>
        {getMessage('cancel')}
      </button>
    </div>
  </form>
}
