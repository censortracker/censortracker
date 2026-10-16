import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { countryCode } from './proxy-check-data'
import { isRecord, isStringArray, toRecord } from './value'

export type SiteRules = Record<string, string[]>
type SiteRule = [host: string, countries: string[]]
export interface SiteRuleChange {
  host?: string
  countries?: string[] | null
}

export const hasSiteRestriction = (host: string, rules: SiteRules) => {
  const match = findHostMatch(host, new Set(Object.keys(rules)))

  return Boolean(match && rules[match]?.length)
}

export const validateSiteRules = (value: unknown): SiteRules => {
  if (!isRecord(value) || Object.keys(value).length > 1000) {
    throw new TypeError('Invalid site rules')
  }
  const entries: SiteRule[] = Object.entries(value).map(([host, codes]) => {
    const hostname = normalizeHostname(host)

    if (!hostname || !isStringArray(codes) || codes.length > 676 ||
      codes.some((code) => !countryCode(code))) {
      throw new TypeError('Invalid site rule')
    }
    return [hostname, Array.from(new Set(codes))]
  })

  return Object.fromEntries(entries)
}

// The change comes from a page message.
export const changeSiteRule = (current: unknown, change: unknown) => {
  const { host, countries } = toRecord(change)
  const hostname = normalizeHostname(host)

  if (!hostname) {
    throw new TypeError('Invalid site hostname')
  }
  const rules = validateSiteRules(current)

  if (countries === null) {
    delete rules[hostname]
  } else {
    Object.assign(rules, validateSiteRules({ [hostname]: countries }))
  }
  return validateSiteRules(rules)
}
