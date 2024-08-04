const ReturnSymbol = Symbol('proxy return')
const ResolveSymbol = Symbol('proxy resolve')

// Symbol for caching `jest.fn`
const MockSymbol = Symbol('mock')
const DEFAULT_PROMISE_DEPTH = 20

// eslint-disable-next-line no-unused-vars
export function deepMock (promiseDepth = DEFAULT_PROMISE_DEPTH) {
  const cache = {
    // This Jest mock gets called inside the proxy apply operation.
    [MockSymbol]: jest.fn(() =>
      ReturnSymbol in cache
        ? cache[ReturnSymbol]
        : (cache[ReturnSymbol] = deepMock()),
    ),
  }

  return new Proxy(
    class {},
    {
      get (target, prop) {
        if (prop in cache) {
          return cache[prop]
        }
        if (prop === 'then' && promiseDepth === 0) {
          return undefined
        }
        // Provide string conversion methods.
        if (prop === Symbol.toPrimitive || prop === 'toString') {
          return () => '<mock>' // return any string here.
        }
        return (cache[prop] =
          prop === 'then'
            ? (resolve) =>
              resolve((cache[ResolveSymbol] ??= deepMock(promiseDepth - 1)))
            : deepMock())
      },

      apply (target, thisArg, args) {
        return cache[MockSymbol](...args)
      },
      construct () {
        return deepMock()
      },
    },
  )
}

/**
 * Access the Jest mock function that's wrapping the given deeply mocked function.
 * @param func the target function. It needs to be deeply mocked.
 */
export const mocked = (func) => func[MockSymbol]
