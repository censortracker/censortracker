import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'

import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { RichMessage } from './message'

// Pages pass their own classes, so each page loads only its own styles.
export const Conflicts = ({ classes, compact = false }: {
  classes: { box?: string; title?: string; text?: string; button?: string }
  compact?: boolean
}) => {
  const { value, error: readError } = useResource(async () =>
    (await callBackground('proxyControl')).extensions)
  const { error, run } = useAction()

  usePageError(error || readError)
  const takeControl = () => run(async () => {
    await callBackground('takeProxyControl')
    if (compact) {
      window.close()
    }
    window.location.reload()
  })
  const controlButton = (message: string) =>
    <button type="button" class={classes.button} onClick={takeControl}>
      {compact ? <span>{getMessage(message)}</span> : getMessage(message)}
    </button>

  return <>
    <div id="controlledByOtherExtension" class={classes.box}
      hidden={value?.length !== 1}>
      <RichMessage as="div" class={classes.title} message="controlledByOtherExtensionTitle"
        substitutions={value?.[0]?.name} />
      <RichMessage as="div" class={classes.text} message="controlledByOtherExtensionDesc"
        substitutions={value?.[0]?.name} />
      {controlButton(compact ? 'controlledPageDisableExtension' : 'disableAll')}
    </div>
    <div id="controlledByOtherExtensions" class={classes.box}
      hidden={!value || value.length <= 1}>
      <div class={classes.title}>{getMessage('controlledByOtherExtensions')}</div>
      <div class={classes.text}>
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
