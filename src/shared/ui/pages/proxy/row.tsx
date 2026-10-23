import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import type { CheckAttempt, ProxyCheck } from 'Background/proxy-check-data'
import { checkAttempts } from 'Background/proxy-check-data'
import type { ProxyListAction } from 'Background/proxy-list'
import type { ManagedProxy } from 'Background/proxy-record'
import { proxyAuthSupported } from 'Background/proxy-record'

export const ProxyRow = ({ proxy, check, selected, busy, run, edit }: {
  proxy: ManagedProxy
  check?: ProxyCheck
  selected: boolean
  busy: boolean
  run: (action: ProxyListAction) => void
  edit: (proxy: ManagedProxy) => void
}) => {
  let address = proxy.host ? `${proxy.protocol} ${proxy.host}:${proxy.port}`
    : getMessage('proxyUnavailable')

  if (!proxyAuthSupported(proxy, browser.isFirefox)) {
    address += ` — ${getMessage('proxySocksUnsupported')}`
  }
  if (proxy.provider) {
    address += ` — ${getMessage('proxyAntizapretLimited')}`
  } else if (proxy.restricted) {
    address += ` — ${getMessage('proxyRestricted')}`
  }
  if (proxy.id === 'builtin') {
    address = '—'
  }
  const attempts = checkAttempts(check)
  const describe = (attempt: CheckAttempt) => [
    getMessage(`proxyCheckReason_${attempt.code.replaceAll('-', '_')}`),
    attempt.netError, attempt.httpStatus,
  ].filter(Boolean).join(' · ')
  const last = attempts.at(-1)
  let status = getMessage(`proxyStatus_${check?.status || 'unchecked'}`)

  if (check?.status === 'failed' && last) {
    status += ` · ${describe(last)}`
  }
  if (check?.status === 'ok') {
    status += ` · ${check.latency} ms`
  }
  const title = check ? [
    new Date(check.checkedAt).toLocaleString(getUILanguage()),
    ...attempts.map((attempt) => `${attempt.service}: ${describe(attempt)}`),
  ].join('\n') : undefined

  return <tr>
    <td><input type="checkbox" checked={selected} disabled={busy} aria-label={proxy.name}
      onChange={(event) => run({ operation: 'toggle', id: proxy.id, selected: event.currentTarget.checked })} /></td>
    <td>{proxy.name}</td>
    <td>{address}</td>
    <td title={title}>{status}
      {check?.status === 'ok' && proxy.id !== 'builtin' && <div>
        {`${getMessage('proxyServerCountry')}: ${check.serverCountry || '?'}; ` +
          `${getMessage('proxyExitCountry')}: ${check.exitCountry || '?'} (${check.exitIP})`}
      </div>}
    </td>
    <td>{proxy.id !== 'builtin' && <>
      <button type="button" disabled={busy} onClick={() => edit(proxy)}>{getMessage('proxyEdit')}</button>
      <button type="button" disabled={busy} onClick={() => run({ operation: 'remove', ids: [proxy.id] })}>
        {getMessage('proxyDelete')}
      </button>
    </>}</td>
  </tr>
}
