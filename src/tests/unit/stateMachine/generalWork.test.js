import { actions, configService } from '../../../shared/js/extension'
import { get as getConfig } from '../../env/mockedStorage/dataAccess'

jest.mock(
  '../../../shared/js/extension/base/icon/icon',
  () => ({
    ...jest.requireActual('../../../shared/js/extension/base/icon/icon'),
    updateIcons: jest.fn(() => {}),
  }),
)

jest.mock(
  '../../../shared/js/extension/base/proxy/proxy',
  () => ({
    ...jest.requireActual('../../../shared/js/extension/base/proxy/proxy'),
    takeControl: jest.fn(() => {}),
  }),
)

test('transitions independent from Extension', () => {
  jest.resetModules()
  jest.mock(
    '../../../shared/js/extension/base/extension/extension',
    () => jest.requireActual('../../env/deepMock').deepMock(),
  )
  configService.start()

  // manually initialize extension state machine
  configService.send(({ type: 'disableExtension' }))
  configService.send(({ type: 'enableProxy' }))
  configService.send(({ type: 'enableNotifications' }))

  const state = configService.getSnapshot().value

  expect(state.useProxy || state.showNotifications).toBe(undefined)
  configService.stop()
  jest.resetModules()
})

// xstate action functions run synchronously,
// so state machine doesn't wait for async funcrtions to finish.
// Timeouts are used as an ad hoc (crutch / duct tape) solution.

test('checking correct state machine values on start-up', (done) => {
  configService.start()
  actions.enableExtension()

  setTimeout(async () => {
    const { useProxy, showNotifications } = await getConfig('useProxy', 'showNotifications')

    expect(useProxy && showNotifications).toBe(true)
    configService.stop()
    done()
  }, 1000)
}, 3000)

test('disabling extension', (done) => {
  configService.start()
  actions.enableExtension()
  actions.disableExtension()

  setTimeout(async () => {
    const { enableExtension, useProxy } = await getConfig(
      'enableExtension',
      'useProxy',
    )

    // ensure that proxying gets disabled as well
    expect(enableExtension || useProxy).toBe(false)
    configService.stop()
    done()
  }, 1000)
}, 3000)
