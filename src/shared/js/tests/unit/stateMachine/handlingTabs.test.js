import { get as getConfig } from '../../../extension/base/config/configManager'
import { actions, configService } from '../../../extension/stateManager'
import { getIconName } from '../../../utilities'

jest.mock(
  '../../../extension/base/icon/icon',
  () => ({
    ...jest.requireActual('../../../extension/base/icon/icon'),
    updateIcons: jest.fn(() => {}),
  }),
)

// xstate action functions run synchronously,
// so state machine doesn't wait for async funcrtions to finish.
// Timeouts are used as an ad hoc (crutch / duct tape) solution.

test('handle tab create with enabled extension', (done) => {
  configService.start()
  actions.enableExtension()
  actions.handleTabCreate({ id: 0 })

  setTimeout(async () => {
    const { icon } = await getConfig('icon')

    expect(getIconName(icon)).toBe('default')
    configService.stop()
    done()
  }, 3000)
}, 5000)

test('handle tab create with disabled extension', (done) => {
  configService.start()
  actions.disableExtension()
  actions.handleTabCreate({ id: 0 })

  setTimeout(async () => {
    const { icon } = await getConfig('icon')

    expect(getIconName(icon)).toBe('disabled')
    configService.stop()
    done()
  }, 3000)
}, 5000)

test('tab state changes are not tracked with disabled extension', (done) => {
  configService.start()
  actions.disableExtension()
  actions.handleTabState(0, 'loading', 'https://www.bbc.com/')

  setTimeout(async () => {
    const { icon } = await getConfig('icon')

    expect(getIconName(icon)).toBe('disabled')
    configService.stop()
    done()
  }, 3000)
}, 5000)
