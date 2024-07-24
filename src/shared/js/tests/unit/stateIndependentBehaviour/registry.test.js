import { Extension } from '../../../extension/base'

test('adding hostname to the list of ignored', async () => {
  await Extension.ignoredDomains.add('bbc.com')

  const isInRegistry = await Extension.registry.contains('bbc.com')

  expect(isInRegistry).toBe(false)
})

test('adding hostname to the custom proxied list', async () => {
  await Extension.registry.add('example.com')

  const isInRegistry = await Extension.registry.contains('example.com')

  expect(isInRegistry).toBe(true)
})

test('adding hostname to both ignored and custom proxied lists', async () => {
  await Extension.registry.add('example.com')
  await Extension.ignoredDomains.add('example.com')

  const isInRegistry = await Extension.registry.contains('example.com')

  expect(isInRegistry).toBe(false)
})
