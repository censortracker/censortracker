/** Wrap an API that uses callbacks with Promises
 * This expects the pattern function withCallback(arg1, arg2, ... argN, callback)
 * @author Keith Henry <keith.henry@evolutionjobs.co.uk>
 * @license MIT */

function promisify (fn, parseCB) {
  return (...args) => {
    let safeArgs = args
    let callback

    if (args && args.length > 0) {
      const last = args[args.length - 1]

      if (typeof last === 'function') {
        safeArgs = args.slice(0, args.length - 1)
        callback = last
      }
    }
    return new Promise((resolve, reject) => {
      try {
        fn(...safeArgs, (...cbArgs) => {
          if (callback) {
            try {
              // eslint-disable-next-line standard/no-callback-literal
              callback(...cbArgs)
            } catch (error) {
              reject(error)
            }
          }
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || `Error thrown by API ${chrome.runtime.lastError}`))
          } else if (parseCB) {
            const cbObj = parseCB(...cbArgs)

            resolve(cbObj)
          } else if (!cbArgs || cbArgs.length === 0) {
            resolve()
          } else if (cbArgs.length === 1) {
            resolve(cbArgs[0])
          } else {
            resolve(cbArgs)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

function applyMap (api, apiMap) {
  if (!api) {
    return
  }

  for (const funcDef of apiMap) {
    let funcName

    if (typeof funcDef === 'string') {
      funcName = funcDef
    } else {
      funcName = funcDef.ns
    }

    if (!Object.hasOwnProperty.call(api, funcName)) {
      continue
    }

    const mfunc = api[funcName]

    if (typeof mfunc === 'function') {
      // This is a function, wrap in a promise
      api[funcName] = promisify(mfunc.bind(api), funcDef.cb)
    } else {
      // Sub-API, recurse this func with the mapped props
      applyMap(mfunc, funcDef.props)
    }
  }
}

function createAsyncChrome (apiMaps) {
  const asyncChrome = chrome

  // eslint-disable-next-line guard-for-in
  for (const apiName in apiMaps) {
    const callbackApi = asyncChrome[apiName]

    if (!callbackApi) {
      continue
    }

    const apiMap = apiMaps[apiName]

    applyMap(callbackApi, apiMap)
  }
  return asyncChrome
}

const knownA11ySetting = ['get', 'set', 'clear']
const knownInContentSetting = ['clear', 'get', 'set', 'getResourceIdentifiers']
const knownInStorageArea = ['get', 'getBytesInUse', 'set', 'remove', 'clear']

export const asyncChrome = createAsyncChrome({
  accessibilityFeatures: [
    {
      ns: 'spokenFeedback',
      props: knownA11ySetting,
    },
    {
      ns: 'largeCursor',
      props: knownA11ySetting,
    },
    {
      ns: 'stickyKeys',
      props: knownA11ySetting,
    },
    {
      ns: 'highContrast',
      props: knownA11ySetting,
    },
    {
      ns: 'screenMagnifier',
      props: knownA11ySetting,
    },
    {
      ns: 'autoclick',
      props: knownA11ySetting,
    },
    {
      ns: 'virtualKeyboard',
      props: knownA11ySetting,
    },
    {
      ns: 'animationPolicy',
      props: knownA11ySetting,
    }],
  alarms: ['get', 'getAll', 'clear', 'clearAll'],
  bookmarks: [
    'get', 'getChildren', 'getRecent', 'getTree', 'getSubTree',
    'search', 'create', 'move', 'update', 'remove', 'removeTree'],
  browser: ['openTab'],
  browserAction: [
    'getTitle', 'setIcon', 'getPopup', 'getBadgeText', 'getBadgeBackgroundColor'],
  browsingData: [
    'settings', 'remove', 'removeAppcache', 'removeCache',
    'removeCookies', 'removeDownloads', 'removeFileSystems',
    'removeFormData', 'removeHistory', 'removeIndexedDB',
    'removeLocalStorage', 'removePluginData', 'removePasswords',
    'removeWebSQL'],
  commands: ['getAll'],
  contentSettings: [
    {
      ns: 'cookies',
      props: knownInContentSetting,
    },
    {
      ns: 'images',
      props: knownInContentSetting,
    },
    {
      ns: 'javascript',
      props: knownInContentSetting,
    },
    {
      ns: 'location',
      props: knownInContentSetting,
    },
    {
      ns: 'plugins',
      props: knownInContentSetting,
    },
    {
      ns: 'popups',
      props: knownInContentSetting,
    },
    {
      ns: 'notifications',
      props: knownInContentSetting,
    },
    {
      ns: 'fullscreen',
      props: knownInContentSetting,
    },
    {
      ns: 'mouselock',
      props: knownInContentSetting,
    },
    {
      ns: 'microphone',
      props: knownInContentSetting,
    },
    {
      ns: 'camera',
      props: knownInContentSetting,
    },
    {
      ns: 'unsandboxedPlugins',
      props: knownInContentSetting,
    },
    {
      ns: 'automaticDownloads',
      props: knownInContentSetting,
    }],
  contextMenus: ['create', 'update', 'remove', 'removeAll'],
  cookies: ['get', 'getAll', 'set', 'remove', 'getAllCookieStores'],
  debugger: ['attach', 'detach', 'sendCommand', 'getTargets'],
  desktopCapture: ['chooseDesktopMedia'],
  documentScan: ['scan'],
  downloads: [
    'download', 'search', 'pause', 'resume', 'cancel',
    'getFileIcon', 'erase', 'removeFile', 'acceptDanger'],
  enterprise: [{
    ns: 'platformKeys',
    props: ['getToken', 'getCertificates', 'importCertificate', 'removeCertificate'],
  }],
  extension: ['isAllowedIncognitoAccess', 'isAllowedFileSchemeAccess'],
  fileBrowserHandler: ['selectFile'],
  fileSystemProvider: ['mount', 'unmount', 'getAll', 'get', 'notify'],
  fontSettings: [
    'setDefaultFontSize', 'getFont', 'getDefaultFontSize', 'getMinimumFontSize',
    'setMinimumFontSize', 'getDefaultFixedFontSize', 'clearDefaultFontSize',
    'setDefaultFixedFontSize', 'clearFont', 'setFont', 'clearMinimumFontSize',
    'getFontList', 'clearDefaultFixedFontSize'],
  gcm: ['register', 'unregister', 'send'],
  history: ['search', 'getVisits', 'addUrl', 'deleteUrl', 'deleteRange', 'deleteAll'],
  i18n: ['getAcceptLanguages', 'detectLanguage'],
  identity: [
    'getAuthToken', 'getProfileUserInfo', 'removeCachedAuthToken', 'launchWebAuthFlow'],
  idle: ['queryState'],
  input: [{
    ns: 'ime',
    props: [
      'setMenuItems', 'commitText', 'setCandidates', 'setComposition', 'updateMenuItems',
      'setCandidateWindowProperties', 'clearComposition', 'setCursorPosition', 'sendKeyEvents',
      'deleteSurroundingText'],
  }],
  management: [
    'setEnabled', 'getPermissionWarningsById', 'get', 'getAll',
    'getPermissionWarningsByManifest', 'launchApp', 'uninstall', 'getSelf',
    'uninstallSelf', 'createAppShortcut', 'setLaunchType', 'generateAppForLink'],
  networking: [{
    ns: 'config',
    props: ['setNetworkFilter', 'finishAuthentication'],
  }],
  notifications: ['create', 'update', 'clear', 'getAll', 'getPermissionLevel'],
  pageAction: ['getTitle', 'setIcon', 'getPopup'],
  pageCapture: ['saveAsMHTML'],
  permissions: ['getAll', 'contains', 'request', 'remove'],
  platformKeys: ['selectClientCertificates', 'verifyTLSServerCertificate',
    {
      ns: 'getKeyPair',
      cb: (publicKey, privateKey) => {
        return {
          publicKey,
          privateKey,
        }
      },
    }],
  runtime: [
    'getBackgroundPage', 'openOptionsPage', 'setUninstallURL',
    'restartAfterDelay', 'sendMessage',
    'sendNativeMessage', 'getPlatformInfo', 'getPackageDirectoryEntry',
    {
      ns: 'requestUpdateCheck',
      cb: (status, details) => {
        return {
          status,
          details,
        }
      },
    }],
  scriptBadge: ['getPopup'],
  sessions: ['getRecentlyClosed', 'getDevices', 'restore'],
  storage: [ // Todo: this should extend StorageArea.prototype instead
    {
      ns: 'sync',
      props: knownInStorageArea,
    },
    {
      ns: 'local',
      props: knownInStorageArea,
    },
    {
      ns: 'managed',
      props: knownInStorageArea,
    }],
  socket: [
    'create', 'connect', 'bind', 'read', 'write', 'recvFrom', 'sendTo',
    'listen', 'accept', 'setKeepAlive', 'setNoDelay', 'getInfo', 'getNetworkList'],
  sockets: [
    {
      ns: 'tcp',
      props: [
        'create', 'update', 'setPaused', 'setKeepAlive', 'setNoDelay', 'connect',
        'disconnect', 'secure', 'send', 'close', 'getInfo', 'getSockets'],
    },
    {
      ns: 'tcpServer',
      props: [
        'create', 'update', 'setPaused', 'listen', 'disconnect', 'close', 'getInfo', 'getSockets'],
    },
    {
      ns: 'udp',
      props: [
        'create', 'update', 'setPaused', 'bind', 'send', 'close', 'getInfo',
        'getSockets', 'joinGroup', 'leaveGroup', 'setMulticastTimeToLive',
        'setMulticastLoopbackMode', 'getJoinedGroups', 'setBroadcast'],
    }],
  system: [
    {
      ns: 'cpu',
      props: ['getInfo'],
    },
    {
      ns: 'memory',
      props: ['getInfo'],
    },
    {
      ns: 'storage',
      props: ['getInfo', 'ejectDevice', 'getAvailableCapacity'],
    }],
  tabCapture: ['capture', 'getCapturedTabs'],
  tabs: [
    'get', 'getCurrent', 'sendMessage', 'create', 'duplicate',
    'query', 'highlight', 'update', 'move', 'reload', 'remove',
    'detectLanguage', 'captureVisibleTab', 'executeScript',
    'insertCSS', 'setZoom', 'getZoom', 'setZoomSettings',
    'getZoomSettings', 'discard'],
  topSites: ['get'],
  tts: ['isSpeaking', 'getVoices', 'speak'],
  types: ['set', 'get', 'clear'],
  vpnProvider: ['createConfig', 'destroyConfig', 'setParameters', 'sendPacket', 'notifyConnectionStateChanged'],
  wallpaper: ['setWallpaper'],
  webNavigation: ['getFrame', 'getAllFrames', 'handlerBehaviorChanged'],
  windows: ['get', 'getCurrent', 'getLastFocused', 'getAll', 'create', 'update', 'remove'],
  proxy: [{
    ns: 'settings',
    props: ['set', 'get', 'clear'],
  }],
})
