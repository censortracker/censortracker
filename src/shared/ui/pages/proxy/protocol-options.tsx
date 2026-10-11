export const ProtocolOptions = () => <>
  {['HTTPS', 'HTTP', 'SOCKS5', 'SOCKS4'].map((value) => <option key={value}>{value}</option>)}
</>
