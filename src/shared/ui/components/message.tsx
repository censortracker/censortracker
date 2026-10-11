import { getMessage } from 'Background/i18n'
import type { HTMLAttributes } from 'preact'

const escapeHTML = (text: string) => text.replace(/[&<>"']/g, (character) => {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
  }

  return entities[character]
})

type Props = Pick<HTMLAttributes<HTMLElement>, 'id' | 'class' | 'hidden'> & {
  message: string
  substitutions?: string | string[]
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2'
}

// Catalogs contain trusted markup. Values from tabs and extensions do not.
export const RichMessage = ({
  message, substitutions = [], as: Tag = 'span', ...props
}: Props) => {
  const values = typeof substitutions === 'string' ? [substitutions] : substitutions

  return <Tag {...props} dangerouslySetInnerHTML={{
    __html: getMessage(message, values.map(escapeHTML)),
  }} />
}
