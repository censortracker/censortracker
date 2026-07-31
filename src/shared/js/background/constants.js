export const TaskType = {
  PING: 'ping',
  REMOVE_BAD_PROXIES: 'removeBadProxies',
  SET_PROXY: 'setProxy',
  CHECK_LOCAL_PROXY: 'checkLocalProxy',
}

/**
 * The only source of truth about which proxy the extension uses.
 * Values match the «value» attributes of the radio buttons
 * on the «proxy-options.html» page.
 */
export const ProxyMode = {
  DEFAULT: 'default',
  CUSTOM: 'custom',
  LOCAL: 'local',
}
