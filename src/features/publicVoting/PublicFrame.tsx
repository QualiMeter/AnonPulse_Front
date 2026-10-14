import type { ReactNode } from 'react'
import { Brand } from '../../components/Brand'
import './publicVoting.css'

export function PublicFrame({ id, children, compact = false }: { id: string; children: ReactNode; compact?: boolean }) {
  return <div className="vote-page"><header className="vote-header"><div className="vote-header__inner"><span className="vote-header__brand"><Brand /></span></div></header><main className={`vote-main ${compact ? 'vote-main--compact' : ''}`} id="main-content" data-poll-id={id}>{children}</main><footer className="vote-page-footer"><span>AnonPulse · обратная связь без входа в аккаунт</span></footer></div>
}
