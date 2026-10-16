import type { ButtonHTMLAttributes } from 'preact'

import componentStyles from './button.module.scss'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class'> {
  variant?: 'dark' | 'light'
  class?: string
}

export const Button = ({ variant = 'dark', class: extra = '', ...props }: Props) =>
  <button type="button" class={`${componentStyles.btn} ${componentStyles[`btn-${variant}`]} ${extra}`}
    {...props} />
