import type { ProxyCheck } from 'Background/proxy-check-data'
import { countryCode } from 'Background/proxy-check-data'
import type { ProxyRecord } from 'Background/proxy-record'

export const countryFields = ['serverCountry', 'exitCountry'] as const
export type CountryField = typeof countryFields[number]
export const proxySorts = ['', 'name', 'latency', ...countryFields] as const
export type ProxySort = typeof proxySorts[number]
export const isProxySort = (value: string): value is ProxySort =>
  proxySorts.some((sort) => sort === value)

export type ProxyFilters = Record<CountryField, string> & { sort: ProxySort }

export const checkedCountry = (check: ProxyCheck | undefined, field:
CountryField) =>
  (check?.status === 'ok' && countryCode(check[field])) || '?'

const isCountryField = (sort: ProxySort): sort is CountryField =>
  countryFields.some((field) => field === sort)

type Proxy = Pick<ProxyRecord, 'id' | 'name'>

export const filterProxies = <T extends Proxy>(proxies: T[],
  checks: Record<string, ProxyCheck>, options: ProxyFilters) => {
  const { sort } = options
  const result = proxies.filter(({ id }) =>
    countryFields.every((field) =>
      !options[field] || checkedCountry(checks[id], field) === options[field]))

  if (sort === 'name') {
    result.sort((first, second) => (first.name || '').localeCompare(second.name || ''))
  } else if (sort === 'latency') {
    const latency = ({ id }: Proxy) => {
      const check = checks[id]

      return check?.status === 'ok' && check.latency !== undefined &&
        Number.isFinite(check.latency) ? check.latency : Infinity
    }

    result.sort((first, second) => latency(first) - latency(second))
  } else if (isCountryField(sort)) {
    const country = ({ id }: Proxy) => checkedCountry(checks[id], sort)
      .replace('?', 'ZZZ')

    result.sort((first, second) =>
      country(first).localeCompare(country(second)))
  }
  return result
}
