import type { MouseEvent, ReactNode } from 'react'

type Props = {
  to: string
  navigate: (to: string) => void
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function AppLink({ to, navigate, children, className, ariaLabel }: Props) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={onClick} className={className} aria-label={ariaLabel}>{children}</a>
}
