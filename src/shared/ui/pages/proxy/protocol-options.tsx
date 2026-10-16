export const proxyProtocols = ['HTTPS', 'HTTP', 'SOCKS5', 'SOCKS4'] as const
export type ProxyProtocol = typeof proxyProtocols[number]

export const isProxyProtocol = (value: string): value is ProxyProtocol =>
  proxyProtocols.some((protocol) => protocol === value)

export const ProtocolSelect = ({ id, value, disabled, onChange }: {
  id: string
  value: ProxyProtocol
  disabled: boolean
  onChange: (protocol: ProxyProtocol) => void
}) => <select id={id} disabled={disabled} value={value} onChange={(event) => {
  const protocol = event.currentTarget.value

  if (isProxyProtocol(protocol)) {
    onChange(protocol)
  }
}}>
  {proxyProtocols.map((protocol) => <option key={protocol}>{protocol}</option>)}
</select>
