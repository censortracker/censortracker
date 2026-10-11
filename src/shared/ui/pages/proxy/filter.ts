import type { ProxyCheck } from 'Background/proxy-check-data'
import { countryCode } from 'Background/proxy-check-data'
import type { ProxyRecord } from 'Background/proxy-record'

export interface ProxyFilters {
  serverCountry: string;
  exitCountry: string;
  sort: string
}
type CountryField = 'serverCountry' | 'exitCountry'
const countryFields: CountryField[] = ['serverCountry', 'exitCountry']

export const checkedCountry = (check: ProxyCheck | undefined, field:
CountryField) =>
  (check?.status === 'ok' && countryCode(check[field])) || '?'

export const filterProxies = (proxies: ProxyRecord[], checks: Record<string,
  ProxyCheck>, options: ProxyFilters) => {
  const result = proxies.filter(({ id }) =>
    countryFields.every((field) =>
      !options[field] || checkedCountry(checks[id], field) === options[field]))

  if (options.sort === 'name') {
    result.sort((first, second) => (first.name || '').localeCompare(second.name || ''))
  } else if (options.sort === 'latency') {
    const latency = ({ id }: ProxyRecord) => checks[id]?.status === 'ok' &&
      Number.isFinite(checks[id].latency) ? checks[id].latency! : Infinity

    result.sort((first, second) => latency(first) - latency(second))
  } else if (['serverCountry', 'exitCountry'].includes(options.sort)) {
    const country = ({ id }: ProxyRecord) => checkedCountry(checks[id],
      options.sort as CountryField)
      .replace('?', 'ZZZ')

    result.sort((first, second) =>
      country(first).localeCompare(country(second)))
  }
  return result
}
