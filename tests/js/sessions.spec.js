import sessions from '../../src/chrome/js/core/sessions'

beforeEach(() => {
  sessions.requests.clear()
})

const { id, key, value } = { id: 13241, key: 'Key', value: 'Value' }

describe('Default max redirections count', () => {
  test('it should be equal to 6', () => {
    expect(sessions.max_redirections_count).toEqual(6)
  })
})

describe('Put request to session', () => {
  test('it should put request id to the map sessions.requests', () => {
    sessions.putRequest(id, key, value)
    expect(sessions.requests.has(id)).toBeTruthy()
  })
})

describe('Get request from session', () => {
  test('it should return data for passed request id', () => {
    sessions.putRequest(id, key, value)
    expect(sessions.getRequest(id, key)).toEqual(value)
    expect(sessions.getRequest(id, 'randomKey', 'default')).toEqual('default')
  })
})

describe('Get request id from map', () => {
  test('it should delete data of request by id', () => {
    sessions.putRequest(id, key, value)
    expect(sessions.requests.has(id)).toBeTruthy()
    expect(sessions.deleteRequest(id, key)).toBeUndefined()
    expect(sessions.requests.has(id)).toBeFalsy()
  })
})

describe('Check if max redirections count reached', () => {
  test('it should return true if passed number larger than allowed max redirections count', () => {
    expect(sessions.areMaxRedirectsReached(5)).toBeFalsy()
    expect(sessions.areMaxRedirectsReached(6)).toBeTruthy()
  })
})
