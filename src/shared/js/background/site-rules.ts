import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { countryCode } from './proxy-check-data'

export type SiteRules = Record<string, string[]>
export interface SiteRuleChange {
  host?: string
  countries?: string[] | null
}

export const hasSiteRestriction = (host: string, rules: SiteRules) => {
  const match = findHostMatch(host, new Set(Object.keys(rules)))

  return Boolean(match && rules[match].length > 0)
}

export const validateSiteRules = (value: unknown): SiteRules => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length > 1000) {
    throw new TypeError('Invalid site rules')
  }
  const entries = Object.entries(value).map(([host, codes]) => {
    const hostname = normalizeHostname(host)

    if (!hostname || !Array.isArray(codes) || codes.length > 676 ||
      codes.some((code) => !countryCode(code))) {
      throw new TypeError('Invalid site rule')
    }
    return [hostname, Array.from(new Set(codes))]
  })

  return Object.fromEntries(entries)
}

export const changeSiteRule = (current: unknown,
  {
    host,
    countries,
  }: SiteRuleChange = {
  }) => {
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
