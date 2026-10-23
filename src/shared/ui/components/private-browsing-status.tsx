export const PrivateBrowsingStatus = ({ failure, status }: {
  failure: unknown
  status: string
}) => <p hidden={!failure && !status} role={failure ? 'alert' : 'status'}>
  {failure instanceof Error ? failure.message : status}
</p>
