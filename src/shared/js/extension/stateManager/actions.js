import configService from './stateMachine'

export const enableExtension = () => {
  configService.send({ type: 'enableExtension' })
}

export const disableExtension = () => {
  configService.send({ type: 'disableExtension' })
}

export const enableProxy = () => {
  configService.send({ type: 'enableProxy' })
}

export const disableProxy = () => {
  configService.send({ type: 'disableProxy' })
}

export const enableNotifications = () => {
  configService.send({ type: 'enableNotifications' })
}

export const disableNotifications = () => {
  configService.send({ type: 'disableNotifications' })
}

export const resetExtension = () => {
  configService.send({ type: 'resetExtension' })
}

export const handleInstalled = ({ reason }) => {
  configService.send({ type: 'installed', reason })
}

export const handleTabCreate = async (tab) => {
  configService.send({ type: 'handleTabCreate', tabId: tab.id })
}

export const handleTabState = async (
  tabId,
  { status = 'loading' } = {},
  { url } = {},
) => {
  configService.send({ type: 'handleTabState', tabId, status, url })
}

export const handleObservedHostsChange = () => {
  configService.send({ type: 'handleObservedHostsChange' })
}

export const updateRegistry = () => {
  configService.send({ type: 'updateRegistry' })
}

export const importSettings = (settings) => {
  configService.send({ type: 'importSettings', settings })
}
