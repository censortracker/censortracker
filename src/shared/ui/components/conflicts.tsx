import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'

import { useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import settings from '../styles/options.module.scss'
import popup from '../styles/popup.module.scss'
import { RichMessage } from './message'
import notice from './notice.module.scss'

export const Conflicts = ({ compact = false }: { compact?: boolean }) => {
  const { value, error } = useResource(async () => {
    if (!await ProxyManager.controlledByOtherExtensions()) {
      return []
    }
    const self = await browser.management.getSelf()
    const installed = await browser.management.getAll()

    return installed.filter(({ name, permissions }) =>
      permissions?.includes('proxy') && name !== self.name)
  })

  usePageError(error)
  const styles = compact ? popup : notice
  const takeControl = async () => {
    await ProxyManager.takeControl()
    await ProxyManager.setProxy()
    if (compact) {
      window.close()
    } else {
      await ProxyManager.controlledByThisExtension()
    }
    window.location.reload()
  }
  const title = compact ? `${popup['title-extension']} ${popup['title-disabled']}`
    : notice.extension__title
  const description = compact ? popup['text-extension'] : settings.extension__text
  const controlButton = (message: string) => compact
    ? <div class={styles['default-btn']} onClick={takeControl}>
      <span>{getMessage(message)}</span>
    </div>
    : <a class={styles['default-btn']} onClick={takeControl}>{getMessage('disableAll')}</a>

  return <>
    <div id="controlledByOtherExtension" class={styles['main-page__extension']}
      hidden={value?.length !== 1}>
      <RichMessage as="div" class={title} message="controlledByOtherExtensionTitle"
        substitutions={value?.[0]?.name} />
      <RichMessage as="div" class={description} message="controlledByOtherExtensionDesc"
        substitutions={value?.[0]?.name} />
      {controlButton('controlledPageDisableExtension')}
    </div>
    <div id="controlledByOtherExtensions" class={styles['main-page__extension']}
      hidden={!value || value.length <= 1}>
      <div class={title}>{getMessage('controlledByOtherExtensions')}</div>
      <div class={description}>
        <div>{getMessage('controlledByOtherExtensionsDesc')}</div>
        <ol id="extensionsWhichControlsProxy">
          {value?.map((extension) => <li key={extension.id}>
            {extension.shortName || extension.name}
          </li>)}
        </ol>
      </div>
      {controlButton('disableAll')}
    </div>
  </>
}
