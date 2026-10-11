import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'
import { useState } from 'preact/hooks'

import { useAction } from '../../hooks/async'
import styles from '../../styles/popup.module.scss'

export const RelatedDomains = ({ tabId, url }: {
  tabId?: number; url: string
}) => {
  const { busy, run } = useAction()
  const [hosts, setHosts] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const execute = (add: boolean) => run(async () => {
    setStatus(getMessage('relatedDomainsWorking'))
    try {
      if (add) {
        const count = await callBackground('addRelatedDomains', selected)

        setHosts([])
        setSelected([])
        setStatus(getMessage('relatedDomainsAdded', String(count)))
      } else {
        setHosts([])
        setSelected([])
        const found = await callBackground('findRelatedDomains', { tabId, url })

        setHosts(found)
        setStatus(getMessage('relatedDomainsFound', String(found.length)))
      }
    } catch {
      setStatus(getMessage(add ? 'relatedDomainsSaveError' : 'relatedDomainsError'))
    }
  })

  return <details id="relatedDomains">
    <summary>{getMessage('relatedDomainsTitle')}</summary>
    <p class={styles.proxy_info}>{getMessage('relatedDomainsHelp')}</p>
    <button id="relatedDomainsScan" class={styles['default-btn']} type="button"
      disabled={busy} onClick={() => execute(false)}>{getMessage('relatedDomainsScan')}</button>
    <div id="relatedDomainsList">{hosts.map((host) => <label key={host}>
      <input type="checkbox" value={host} checked={selected.includes(host)} disabled={busy}
        onChange={(event) => setSelected(event.currentTarget.checked
          ? [...selected, host] : selected.filter((item) => item !== host))}
      />{host}
    </label>)}</div>
    <button id="relatedDomainsAdd" class={styles['default-btn']} type="button"
      disabled={busy || selected.length === 0} onClick={() => execute(true)}>{getMessage('relatedDomainsAdd')}</button>
    <p id="relatedDomainsStatus" class={styles.proxy_info} role="status">{status}</p>
  </details>
}
