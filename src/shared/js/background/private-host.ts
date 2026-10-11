/* eslint-disable no-bitwise */
// This function also runs inside PAC: use only its arguments and local helpers.
export const isPrivateHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  const privateIPv4 = (parts: number[]) => {
    const [first, second, third] = parts

    return first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 168 ||
        (second === 0 && third === 2))) ||
      (first === 198 && (second === 18 || second === 19 ||
        (second === 51 && third === 100))) ||
      (first === 203 && second === 0 && third === 113)
  }

  if (!host.includes(':')) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return privateIPv4(host.split('.').map(Number))
    }
    return !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|lan|home|internal|home\.arpa)$/.test(host) ||
      /(?:^|\.)(?:localdomain|intranet|corp|private|test|invalid)$/.test(host)
  }

  // Expand compressed IPv6 and dotted IPv4 tails without a DNS lookup.
  const address = host.replace(/\d+\.\d+\.\d+\.\d+$/, (tail) => {
    const parts = tail.split('.').map(Number)

    return `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`
  })
  const halves = address.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const words = (halves.length === 2
    ? [...left, ...new Array(8 - left.length - right.length).fill('0'), ...right]
    : left).map((word) => parseInt(word, 16))
  const first = words[0]

  if (words.slice(0, 6).every((word) => word === 0) ||
    (first === 0x64 && words[1] === 0xFF9B && words[2] === 1)) {
    return true
  }
  if ((words.slice(0, 5).every((word) => word === 0) && words[5] === 0xFFFF) ||
    (first === 0x64 && words[1] === 0xFF9B &&
      words.slice(2, 6).every((word) => word === 0))) {
    return privateIPv4([words[6] >> 8, words[6] & 255,
      words[7] >> 8, words[7] & 255])
  }
  return (first & 0xFE00) === 0xFC00 || (first & 0xFFC0) === 0xFE80 ||
    (first & 0xFFC0) === 0xFEC0 || (first & 0xFF00) === 0xFF00 ||
    (first === 0x2001 && words[1] === 0xDB8)
}
