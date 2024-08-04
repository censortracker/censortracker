import extension from '../../../shared/js/extension/base/extension'

test('testing norn=mal host', async () => {
  const result = await extension.handlers.handleTabState({
    tabId: 0, status: 'loading', url: 'https://example.com/',
  })

  expect(result).toBe('normal')
})

test('testing blocked host', async () => {
  const result = await extension.handlers.handleTabState({
    tabId: 0, status: 'loading', url: 'https://www.bbc.com/',
  })

  expect(result).toBe('blocked')
})

test('testing blocked host of level 3', async () => {
  const result = await extension.handlers.handleTabState({
    tabId: 0, status: 'loading', url: 'https://ru.iherb.com/',
  })

  expect(result).toBe('blocked')
})

jest.mock('../../../shared/js/extension/base/notifications/notifications', () => ({
  ...jest.requireActual('../../../shared/js/extension/base/notifications/notifications'),
  showDisseminatorWarning: (url) => console.log('Notification from:', url),
}))

test('testing disseminator', async () => {
  const result = await extension.handlers.handleTabState({
    tabId: 0, status: 'loading', url: 'https://www.avito.ru/',
  })

  expect(result).toBe('disseminator')
})
