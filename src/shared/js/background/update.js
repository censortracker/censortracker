import browser from './browser-api'
import { fetchWithTimeout } from './utilities'

// This build is distributed through GitHub Releases, not a web store, so
// `runtime.onUpdateAvailable` never fires for it — that event is the browser
// telling the extension a store update is staged, and there is no store here.
// The release feed is polled instead.
const RELEASES_API_URL =
  'https://api.github.com/repos/avatarDD/censortracker/releases/latest'

const RELEASES_PAGE_URL =
  'https://github.com/avatarDD/censortracker/releases/latest'

// Six hours. Frequent enough that a fix is noticed the same day, rare enough
// to stay far below GitHub's unauthenticated rate limit even with the check
// also running at every browser start.
export const UPDATE_CHECK_INTERVAL_MINUTES = 360

/**
 * Splits a version into numeric parts, ignoring a leading "v" and anything
 * after the numbers (a "-rc1" suffix and the like).
 * @param value {string} Version or tag name.
 * @returns {Array<number>|null} Parts, or null when unparseable.
 */
const parseVersion = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().replace(/^v/i, '').match(/^\d+(\.\d+)*/)

  if (!match) {
    return null
  }

  return match[0].split('.').map(Number)
}

/**
 * Compares two versions part by part, treating a missing part as 0 so that
 * "20.9" and "20.9.0" are equal.
 * @param left {string}
 * @param right {string}
 * @returns {number|null} >0 when left is newer, null when either is unparseable.
 */
export const compareVersions = (left, right) => {
  const first = parseVersion(left)
  const second = parseVersion(right)

  if (!first || !second) {
    return null
  }

  const length = Math.max(first.length, second.length)

  for (let index = 0; index < length; index += 1) {
    const difference = (first[index] || 0) - (second[index] || 0)

    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

/**
 * Puts a marker on the toolbar icon, or clears it.
 *
 * Deliberately a badge rather than a system notification: an update is not
 * urgent, and a popup that interrupts whatever the user is doing to announce
 * a patch release earns nothing but a disabled setting.
 * @param visible {boolean}
 * @returns {Promise<void>}
 */
const setUpdateBadge = async (visible) => {
  const action = browser.isFirefox ? browser.browserAction : browser.action

  if (!action || !action.setBadgeText) {
    return
  }

  try {
    await action.setBadgeText({ text: visible ? '↑' : '' })
    if (visible && action.setBadgeBackgroundColor) {
      await action.setBadgeBackgroundColor({ color: '#2e7d32' })
    }
  } catch (error) {
    console.warn(`[Update] Could not set the badge: ${error}`)
  }
}

/**
 * Re-applies the badge from stored state. Called on startup because a badge
 * does not survive a browser restart (or a service worker teardown), while the
 * stored flag does.
 * @returns {Promise<void>}
 */
export const restoreUpdateBadge = async () => {
  const { updateAvailable } =
    await browser.storage.local.get({ updateAvailable: false })

  await setUpdateBadge(updateAvailable)
}

/**
 * Clears the "update available" state — used once the user has followed the
 * link, so the badge does not stay on forever after they have seen it.
 * @returns {Promise<void>}
 */
export const dismissUpdate = async () => {
  await browser.storage.local.set({ updateAvailable: false })
  await setUpdateBadge(false)
}

export const getReleasesPageUrl = () => RELEASES_PAGE_URL

/**
 * Asks GitHub for the newest release and records whether it is ahead of the
 * running build.
 *
 * Never throws: an unreachable or rate-limited API must not surface as an
 * error anywhere, it just means the check is retried on the next tick.
 * @returns {Promise<{updateAvailable: boolean, latestVersion: string}>}
 */
export const checkForUpdate = async () => {
  const currentVersion = browser.runtime.getManifest().version
  const unchanged = { updateAvailable: false, latestVersion: '' }

  try {
    const response = await fetchWithTimeout(RELEASES_API_URL, {
      timeout: 10000,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      console.warn(`[Update] Release check failed: HTTP ${response.status}`)
      return unchanged
    }

    const release = await response.json()

    if (!release || typeof release !== 'object' || release.draft) {
      return unchanged
    }

    const latestVersion = String(release.tag_name || '').replace(/^v/i, '')
    const comparison = compareVersions(latestVersion, currentVersion)

    // A tag that does not parse tells us nothing; leaving the previous state
    // alone beats raising a permanent false alarm.
    if (comparison === null) {
      console.warn(`[Update] Unparseable release tag: ${release.tag_name}`)
      return unchanged
    }

    const updateAvailable = comparison > 0

    await browser.storage.local.set({
      updateAvailable,
      latestVersion,
      latestReleaseUrl: release.html_url || RELEASES_PAGE_URL,
      updateLastCheckedTs: Date.now(),
    })
    await setUpdateBadge(updateAvailable)

    console.log(
      `[Update] Installed ${currentVersion}, latest ${latestVersion}` +
      `${updateAvailable ? ' — update available' : ''}`,
    )

    return { updateAvailable, latestVersion }
  } catch (error) {
    console.warn(`[Update] Release check failed: ${error}`)
    return unchanged
  }
}
