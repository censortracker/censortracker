import browser from '../browser-api'

/**
 * Encapsulates sending transition messages to state machine.
 */
export const sendTransitionMsg = (transition, payload) =>
  browser.runtime.sendMessage({ type: 'transition', request: transition, payload })

/**
 * Encapsulates calls to local storage.
 * @returns {Promise<{}|*>} Resolves when the config is fetched from local storage.
 */
export const sendConfigFetchMsg = (...keys) =>
  browser.runtime.sendMessage({ type: 'dataFetch', request: keys })

/**
 * Encapsulates obtaining data from extension logic.
 * @returns {Promise<{}|*>} Resolves when the data is obtained from the extension logic.
 */
export const sendExtensionCallMsg = async (source, request, payload) =>
  browser.runtime.sendMessage({ type: 'stateFetch', source, request, payload })
