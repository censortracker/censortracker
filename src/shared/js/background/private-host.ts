/* eslint-disable no-bitwise */
// This function also runs inside PAC: use only its arguments and local helpers.
export const isPrivateHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  const privateIPv4 = (parts: number[]) => {
    const [first = 0, second = 0, third = 0] = parts

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
    const [one = 0, two = 0, three = 0, four = 0] = tail.split('.').map(Number)

    return `${((one << 8) | two).toString(16)}:${((three << 8) | four).toString(16)}`
  })
  const halves = address.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const words = (halves.length === 2
    ? [...left, ...new Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left).map((word) => parseInt(word, 16))
  // Missing words are zero, as in the bitwise operations below.
  const wordAt = (index: number) => words[index] ?? 0
  const first = wordAt(0)

  if (words.slice(0, 6).every((word) => word === 0) ||
    (first === 0x64 && wordAt(1) === 0xFF9B && wordAt(2) === 1)) {
    return true
  }
  if ((words.slice(0, 5).every((value) => value === 0) &&
    wordAt(5) === 0xFFFF) ||
    (first === 0x64 && wordAt(1) === 0xFF9B &&
      words.slice(2, 6).every((value) => value === 0))) {
    return privateIPv4([wordAt(6) >> 8, wordAt(6) & 255,
      wordAt(7) >> 8, wordAt(7) & 255])
  }
  return (first & 0xFE00) === 0xFC00 || (first & 0xFFC0) === 0xFE80 ||
    (first & 0xFFC0) === 0xFEC0 || (first & 0xFF00) === 0xFF00 ||
    (first === 0x2001 && wordAt(1) === 0xDB8)
}
