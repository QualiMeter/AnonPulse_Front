import type { ReactNode } from 'react'
import { Brand } from '../../components/Brand'
import { publicDemoIds } from './demoPublicPolls'
import './publicVoting.css'

function DemoControls({ id }: { id: string }) {
  const cases = [
    { label: 'Открытый опрос', url: `/p/${publicDemoIds.open}` },
    { label: 'Повторное участие', url: `/p/${publicDemoIds.open}?demo=repeat` },
    { label: 'Загрузка', url: `/p/${publicDemoIds.open}?demo=loading` },
    { label: 'Ошибка загрузки', url: `/p/${publicDemoIds.open}?demo=load-error` },
    { label: 'Ошибка отправки', url: `/p/${publicDemoIds.open}?demo=submit-error` },
    { label: 'Нет вопросов', url: `/p/${publicDemoIds.open}?demo=empty` },
    { label: 'Слишком много запросов', url: `/p/${publicDemoIds.open}?demo=rate-limit` },
    { label: 'Неоднозначный конфликт', url: `/p/${publicDemoIds.open}?demo=conflict` },
    { label: 'Итоги с решением', url: `/p/${publicDemoIds.closed}/results` },
    { label: 'Итоги без решения', url: `/p/${publicDemoIds.closedEmpty}/results` },
    { label: 'Черновик', url: `/p/${publicDemoIds.draft}` },
    { label: 'Не найден', url: '/p/unknown-demo-id' },
  ]
  return <details className="vote-demo-controls"><summary>Посмотреть другие состояния демо</summary><div>{cases.map(item => <a key={item.label} href={item.url} aria-current={item.url === `${window.location.pathname}${window.location.search}` ? 'page' : undefined}>{item.label}</a>)}</div><p>Переключатель нужен только для оценки интерфейса. Данные сервера здесь не проверяются.</p><span className="sr-only">Текущий опрос: {id}</span></details>
}

export function PublicFrame({ id, children, compact = false }: { id: string; children: ReactNode; compact?: boolean }) {
  return <div className="vote-page"><header className="vote-header"><div className="vote-header__inner"><span className="vote-header__brand"><Brand /></span><span className="vote-header__demo"><span />Демо-режим</span></div></header><main className={`vote-main ${compact ? 'vote-main--compact' : ''}`} id="main-content">{children}</main><footer className="vote-page-footer"><span>AnonPulse · обратная связь без входа в аккаунт</span><DemoControls id={id} /></footer></div>
}
