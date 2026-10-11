import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'
import { Fragment } from 'preact'

import { useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { navigate } from '../navigation'
import styles from '../styles/options.module.scss'
import notice from './notice.module.scss'

export const RegistryStatus = ({ warning = false }: { warning?: boolean }) => {
  const { value, error } = useResource(async () => {
    const status = await callBackground('registryStatus')
    const empty = warning && await callBackground('registryEmpty')
    let text = getMessage(`registryStatus_${status.state}`)

    if (status.skipped > 0) {
      text += ` ${getMessage('registrySkipped', String(status.skipped))}`
    }
    if (status.error) {
      text += ` ${status.error}`
    }
    return { ...status, empty, text }
  }, ['registryStatus', 'domains', 'useRegistry',
    'customProxiedDomains', 'registrySource', 'externalRegistry'])

  usePageError(error)
  return <>
    <p id="builtinRegistryStatus" role="status"
      hidden={value?.state === 'ready' && !value.error}>{value?.text}</p>
    {warning && <div class={notice['main-page__extension']}
      id="optionsRegistryIsEmptyWarning"
      hidden={!value || (!value.empty && value.state !== 'unavailable')}>
      <div class={notice.extension__title}>
        {getMessage(value?.state === 'ready'
          ? 'optionsRegistryIsEmptyTitle' : `registryStatus_${value?.state}`)}
      </div>
      <div class={styles.extension__text}>
        {value?.error || (['ready', 'empty'].includes(value?.state || '')
          ? getMessage('optionsRegistryIsEmptyDesc') : value?.text)}
      </div>
      {[
        ['optionsRegistryUpdateDatabaseButton', 'advanced-options.html'],
        ['optionsRegistryProxyingListButton', 'proxy-list.html'],
      ].map(([id, href]) => <Fragment key={id}><a class={notice['default-btn']} id={id}
        onClick={() => {
          navigate(`/${href}`)
        }}>
        {getMessage(id)}
      </a>{' '}</Fragment>)}
    </div>}
  </>
}
