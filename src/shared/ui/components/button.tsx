import type { ButtonHTMLAttributes } from 'preact'

import componentStyles from './button.module.scss'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'dark' | 'light'
}

export const Button = ({ variant = 'dark', class: extra = '', ...props }: Props) =>
  <button type="button" class={`${componentStyles.btn} ${componentStyles[`btn-${variant}`]} ${extra}`}
    {...props} />
