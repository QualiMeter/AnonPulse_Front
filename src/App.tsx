import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { demoDecisions, demoPolls, demoResults, type Poll, type PollResults, type PollStatus } from './data/demoPolls'
import { Icon } from './components/Icon'
import { Brand } from './components/Brand'
import { AppLink } from './components/AppLink'
import { ResultDistribution } from './components/ResultDistribution'
import { publicFinalResults } from './features/publicVoting/demoPublicResults'
import type { PublicPoll } from './features/publicVoting/demoPublicPolls'
import type { BuilderForm } from './features/pollBuilder/model'
import BuilderPage from './features/pollBuilder/BuilderPage'
import PublicVotingPage from './features/publicVoting/PublicVotingPage'
import PublicResultsPage from './features/publicVoting/PublicResultsPage'
import DecisionPanel from './features/decisions/DecisionPanel'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(value: string) { return dateFormatter.format(new Date(value)) }
function formatShortDate(value: string) { return shortDateFormatter.format(new Date(value)) }
function pluralQuestions(count: number) { return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'вопрос' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'вопроса' : 'вопросов'}` }
function participantNoun(count: number) { return count % 10 === 1 && count % 100 !== 11 ? 'участник' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'участника' : 'участников' }
function pollTitle(poll: Poll) { return poll.title?.trim() || poll.questions[0]?.text || 'Опрос без названия' }

const statusLabels: Record<PollStatus, string> = { draft: 'Черновик', open: 'Активен', closed: 'Завершён' }

function StatusBadge({ status }: { status: PollStatus }) {
  return <span className={`status status--${status}`}><span className="status__dot" />{statusLabels[status]}</span>
}

function usePathname(dirtyRef: { current: boolean }, onBlocked: (path: string) => void) {
  const [path, setPath] = useState(window.location.pathname)
  const pathRef = useRef(path)
  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname
      if (dirtyRef.current && next !== pathRef.current) {
        window.history.pushState(null, '', pathRef.current)
        onBlocked(next)
        return
      }
      pathRef.current = next
      setPath(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [dirtyRef, onBlocked])
  function goAnyway(to: string) {
    window.history.pushState(null, '', to)
    pathRef.current = to
    setPath(to)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function navigate(to: string) {
    if (pathRef.current === to) return
    if (dirtyRef.current) { onBlocked(to); return }
    goAnyway(to)
  }
  return { path, navigate, goAnyway }
}

function Shell({ children, navigate }: { children: ReactNode; navigate: (to: string) => void }) {
  return <>
    <header className="site-header">
      <div className="site-header__inner">
        <AppLink to="/app/polls" navigate={navigate} className="brand-link" ariaLabel="AnonPulse — к списку опросов"><Brand /></AppLink>
        <span className="header-divider" />
        <span className="workspace-name">Пространство преподавателя</span>
        <div className="header-right"><span className="demo-chip"><span className="demo-chip__dot" /><span className="demo-chip__long">Демо-интерфейс</span><span className="demo-chip__short">Демо</span></span><span className="avatar" aria-label="Демонстрационный профиль">М</span></div>
      </div>
    </header>
    <div className="app-layout">
      <aside className="side-nav" aria-label="Навигация">
        <span className="side-nav__eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <AppLink to="/app/polls" navigate={navigate} className="side-nav__item side-nav__item--active"><Icon name="layers" size={19} /><span>Опросы</span></AppLink>
        <div className="side-nav__footer"><span className="side-nav__footer-icon"><Icon name="info" size={17} /></span><p>Первая визуальная версия<br />Данные на странице демонстрационные</p></div>
      </aside>
      <main className="main-content" id="main-content">{children}</main>
    </div>
  </>
}

type Filter = 'all' | PollStatus
const filters: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Все' }, { key: 'open', label: 'Активные' }, { key: 'draft', label: 'Черновики' }, { key: 'closed', label: 'Завершённые' },
]

function Dashboard({ polls, navigate }: { polls: Poll[]; navigate: (to: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const visiblePolls = useMemo(() => polls.filter(poll => {
    const matchesStatus = filter === 'all' || poll.status === filter
    const searchableText = [pollTitle(poll), ...poll.questions.map(question => question.text)].join(' ').toLocaleLowerCase('ru')
    const matchesSearch = searchableText.includes(search.trim().toLocaleLowerCase('ru'))
    return matchesStatus && matchesSearch
  }), [filter, search, polls])

  return <div className="page page--dashboard">
    <div className="page-heading page-heading--dashboard">
      <div><p className="eyebrow">ВАШИ ОПРОСЫ</p><h1>Опросы</h1><p className="page-subtitle">Все темы обратной связи в одном месте.</p></div>
      <div className="page-heading__action"><AppLink to="/app/polls/new" navigate={navigate} className="button button--primary"><Icon name="plus" size={18} />Создать опрос</AppLink><span>Демо-конструктор · без сохранения</span></div>
    </div>

    <section className="list-section" aria-labelledby="poll-list-heading">
      <div className="list-section__top"><div><h2 id="poll-list-heading">Мои опросы <span>{polls.length}</span></h2><p>Статус и история созданных вами опросов</p></div></div>
      <div className="list-tools">
        <div className="filter-tabs" role="group" aria-label="Фильтр по статусу">{filters.map(item => <button key={item.key} type="button" className={`filter-tab ${filter === item.key ? 'filter-tab--active' : ''}`} onClick={() => setFilter(item.key)} aria-pressed={filter === item.key}>{item.label}<span>{item.key === 'all' ? polls.length : polls.filter(poll => poll.status === item.key).length}</span></button>)}</div>
        <label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Поиск опросов по названию или вопросу</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск опроса" /></label>
      </div>
      {visiblePolls.length > 0 ? <div className="poll-list">
        <div className="poll-list__head"><span>ОПРОС</span><span>СТАТУС</span><span>СОЗДАН</span><span /></div>
        {visiblePolls.map(poll => <div className="poll-row" key={poll.id}>
          <div className="poll-row__name"><span className="poll-row__glyph"><Icon name="layers" size={18} /></span><div><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="poll-row__title">{pollTitle(poll)}</AppLink><span className="poll-row__meta">{pluralQuestions(poll.questions.length)}{!poll.title && <span className="poll-row__fallback"> · без названия</span>}</span></div></div>
          <div className="poll-row__status"><StatusBadge status={poll.status} /></div>
          <div className="poll-row__date">{formatShortDate(poll.createdAt)}</div>
          <div className="poll-row__action"><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="row-arrow" ariaLabel={`Открыть опрос «${pollTitle(poll)}»`}><Icon name="arrowRight" size={19} /></AppLink></div>
        </div>)}
      </div> : <div className="empty-state"><div className="empty-state__icon"><Icon name="search" size={24} /></div><h3>Ничего не найдено</h3><p>Попробуйте изменить запрос или выбрать другой статус.</p><button type="button" className="text-button" onClick={() => { setFilter('all'); setSearch('') }}>Сбросить фильтры <Icon name="arrowRight" size={16} /></button></div>}
    </section>
    <p className="fixture-note"><Icon name="info" size={16} />Это демонстрационные опросы для оценки интерфейса. Данные сервера пока не подключены.</p>
  </div>
}

function Breadcrumbs({ poll, navigate, current }: { poll?: Poll; navigate: (to: string) => void; current?: string }) {
  return <nav className="breadcrumbs" aria-label="Путь к странице"><AppLink to="/app/polls" navigate={navigate}>Опросы</AppLink>{poll && <><Icon name="chevronRight" size={15} />{current ? <AppLink to={`/app/polls/${poll.id}`} navigate={navigate}>{pollTitle(poll)}</AppLink> : <span aria-current="page">{pollTitle(poll)}</span>}</>}{current && <><Icon name="chevronRight" size={15} /><span aria-current="page">{current}</span></>}</nav>
}

function DetailPage({ poll, navigate, decision, onDemoPublish, onRequestClose, notice }: { poll: Poll; navigate: (to: string) => void; decision?: string; onDemoPublish: () => void; onRequestClose: () => void; notice?: string }) {
  const hasResults = poll.status !== 'draft'
  const [copyFeedback, setCopyFeedback] = useState('')
  async function copyVotingLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${poll.id}`)
      setCopyFeedback('Демо-ссылка скопирована.')
    } catch {
      setCopyFeedback('Не удалось скопировать ссылку. Откройте страницу голосования и скопируйте её адрес.')
    }
  }
  return <div className="page page--detail">
    <Breadcrumbs poll={poll} navigate={navigate} />
    {notice && <p className="demo-action-notice" role="status"><Icon name="check" size={17} />{notice}</p>}
    <div className="detail-heading"><div><div className="detail-heading__pre"><StatusBadge status={poll.status} /><span className="detail-heading__separator">·</span><span>{pluralQuestions(poll.questions.length)}</span></div><h1>{pollTitle(poll)}</h1><p>{poll.status === 'draft' ? 'Опрос сохранён как черновик и ещё не принимает ответы.' : poll.status === 'open' ? 'Опрос опубликован и принимает ответы по прямой ссылке.' : 'Опрос завершён. Голосование закрыто, результаты доступны для просмотра.'}</p></div></div>
    <div className="detail-grid">
      <div className="detail-main"><div className="section-title"><div><p className="eyebrow">СТРУКТУРА ОПРОСА</p><h2>Вопросы и варианты</h2></div><span>{pluralQuestions(poll.questions.length)}</span></div>
        <div className="questions-list">{poll.questions.map((question, index) => <section className="question-card" key={question.id} aria-labelledby={`question-${question.id}`}><div className="question-card__head"><span className="question-number">{String(index + 1).padStart(2, '0')}</span><div><h3 id={`question-${question.id}`}>{question.text}</h3><p>Один вариант ответа</p></div></div><div className="question-card__options">{question.options.map(item => <div className="question-option" key={item.id}><span className="option-radio" />{item.text}</div>)}</div></section>)}</div>
      </div>
      <aside className="detail-aside"><section className="aside-card action-card"><h2>Действия</h2>{hasResults && <AppLink to={`/app/polls/${poll.id}/results`} navigate={navigate} className="button button--dark action-card__primary"><Icon name="barChart" size={18} />Посмотреть результаты<Icon name="arrowRight" size={18} /></AppLink>}
        {poll.status === 'draft' && <><AppLink to={`/app/polls/${poll.id}/edit`} navigate={navigate} className="button button--dark action-card__primary"><Icon name="edit" size={17} />Редактировать черновик<Icon name="arrowRight" size={18} /></AppLink><div className="future-actions"><button type="button" onClick={onDemoPublish}><Icon name="check" size={17} />Опубликовать в демо</button></div></>}
        {poll.status === 'open' && <div className="future-actions"><AppLink to={`/p/${poll.id}`} navigate={navigate}><Icon name="eye" size={17} />Открыть страницу голосования</AppLink><button type="button" onClick={copyVotingLink}><Icon name="link" size={17} />Скопировать ссылку</button><button type="button" onClick={onRequestClose}><Icon name="lock" size={17} />Закрыть в демо</button></div>}
        {copyFeedback && <p className="action-card__feedback" role="status">{copyFeedback}</p>}
        <p className="action-card__note">{poll.status === 'closed' ? 'Этот опрос больше не принимает ответы.' : 'Изменение статуса работает только в текущей вкладке. На сервер ничего не сохраняется.'}</p>
      </section>
      <section className="aside-card info-card"><h2>Об опросе</h2><dl><div><dt><Icon name="calendar" size={17} />Создан</dt><dd>{formatDate(poll.createdAt)}</dd></div>{poll.publishedAt && <div><dt><Icon name="check" size={17} />Опубликован</dt><dd>{formatDate(poll.publishedAt)}</dd></div>}{poll.closedAt && <div><dt><Icon name="lock" size={17} />Завершён</dt><dd>{formatDate(poll.closedAt)}</dd></div>}<div><dt><Icon name="layers" size={17} />Вопросов</dt><dd>{poll.questions.length}</dd></div></dl></section>
      {decision && <section className="aside-card decision-card"><p className="eyebrow">ЧТО ИЗМЕНИТСЯ</p><h2>Решение преподавателя</h2><p>{decision}</p></section>}</aside>
    </div>
    <p className="fixture-note"><Icon name="info" size={16} />Демонстрационные данные. Действия, изменяющие опрос на сервере, пока недоступны.</p>
  </div>
}

function ResultsPage({ poll, results, navigate, decision, onDemoPublish }: { poll: Poll; results?: PollResults; navigate: (to: string) => void; decision?: string; onDemoPublish: (text: string) => void }) {
  if (!results) return <div className="page"><Breadcrumbs poll={poll} navigate={navigate} current="Результаты" /><div className="state-panel"><div className="state-panel__icon"><Icon name="lock" size={25} /></div><h1>Результаты пока недоступны</h1><p>Статистика появится после публикации опроса.</p><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />Вернуться к опросу</AppLink></div></div>

  return <div className="page page--results">
    <Breadcrumbs poll={poll} navigate={navigate} current="Результаты" />
    <div className="results-heading"><div><p className="eyebrow">{results.resultsType === 'interim' ? 'ПРОМЕЖУТОЧНЫЕ РЕЗУЛЬТАТЫ' : 'ИТОГОВЫЕ РЕЗУЛЬТАТЫ'}</p><h1>Результаты опроса</h1><p>{pollTitle(poll)}</p><span className="results-visibility"><Icon name={results.resultsType === 'interim' ? 'lock' : 'link'} size={15} />{results.resultsType === 'interim' ? 'Видны только преподавателю и администратору' : 'Доступны всем после закрытия опроса'}</span></div><StatusBadge status={poll.status} /></div>
    <div className="results-summary"><div className="results-summary__count"><span>{results.totalParticipants}</span><div><strong>{participantNoun(results.totalParticipants)}</strong><p>{results.totalParticipants === 0 ? 'Пока нет ответов' : 'ответили на этот опрос'}</p></div></div><div className="results-summary__aside"><span>{pluralQuestions(results.questions.length)}</span><p>{results.resultsType === 'interim' ? 'Промежуточные результаты — только для преподавателя. Данные могут измениться.' : 'Итоговые результаты доступны по ссылке после закрытия.'}</p></div></div>
    <div className="results-layout"><div className="results-main"><div className="section-title"><div><p className="eyebrow">РАСПРЕДЕЛЕНИЕ ОТВЕТОВ</p><h2>По каждому вопросу</h2></div></div>
      {results.totalParticipants === 0 && <div className="zero-results"><Icon name="barChart" size={20} /><span>Ответов пока нет. Распределение появится после первого участия.</span></div>}
      <ResultDistribution questions={results.questions} totalParticipants={results.totalParticipants} />
    </div><aside className="results-aside">{poll.status === 'closed' ? <><DecisionPanel key={poll.id} text={decision} onDemoPublish={onDemoPublish} /><AppLink to={`/p/${poll.id}/results`} navigate={navigate} className="results-public-link"><Icon name="eye" size={17} />Публичный вид итогов<Icon name="arrowRight" size={16} /></AppLink></> : <section className="aside-card decision-card decision-card--results"><p className="eyebrow">ПОСЛЕ ОПРОСА</p><h2>Решение преподавателя</h2><p className="decision-card__empty">Решение можно опубликовать после закрытия опроса.</p></section>}<div className="results-aside__hint"><Icon name="info" size={18} /><p>Проценты рассчитаны отдельно для каждого вопроса и могут не складываться ровно в 100% из-за округления.</p></div></aside></div>
    <p className="fixture-note"><Icon name="info" size={16} />Числа и ответы показаны на демонстрационных данных. Обновление результатов появится после подключения API.</p>
  </div>
}

function NotFound({ navigate }: { navigate: (to: string) => void }) {
  return <div className="page"><div className="state-panel"><div className="state-panel__icon"><Icon name="search" size={24} /></div><h1>Опрос не найден</h1><p>Проверьте ссылку или вернитесь к списку опросов.</p><AppLink to="/app/polls" navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />К списку опросов</AppLink></div></div>
}

function EditUnavailable({ poll, navigate }: { poll: Poll; navigate: (to: string) => void }) {
  return <div className="page"><Breadcrumbs poll={poll} navigate={navigate} current="Редактирование" /><div className="state-panel"><div className="state-panel__icon"><Icon name="lock" size={24} /></div><h1>Редактирование недоступно</h1><p>Изменять можно только черновики. Опубликованный или завершённый опрос остаётся без изменений.</p><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />К опросу</AppLink></div></div>
}

function pollFromDemoForm(form: BuilderForm, existing?: Poll): Poll {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    title: form.title.trim() || null,
    status: 'draft',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    publishedAt: null,
    closedAt: null,
    questions: form.questions.map((question, position) => ({
      id: crypto.randomUUID(), text: question.text.trim(), position,
      options: question.options.map((option, optionPosition) => ({ id: crypto.randomUUID(), text: option.text.trim(), position: optionPosition })),
    })),
  }
}

function emptyDemoResults(poll: Poll): PollResults {
  return {
    id: poll.id, status: 'open', resultsType: 'interim', totalParticipants: 0,
    questions: poll.questions.map(question => ({
      ...question,
      options: question.options.map(option => ({ ...option, voteCount: 0, percentage: 0 })),
    })),
  }
}

export default function App() {
  const dirtyRef = useRef(false)
  const [polls, setPolls] = useState<Poll[]>(() => [...demoPolls])
  const [resultsById, setResultsById] = useState<Record<string, PollResults>>(() => ({ ...demoResults }))
  const [decisions, setDecisions] = useState<Record<string, string>>(() => ({ ...demoDecisions }))
  const [notices, setNotices] = useState<Record<string, string>>({})
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [closingPollId, setClosingPollId] = useState<string | null>(null)
  const { path, navigate, goAnyway } = usePathname(dirtyRef, setPendingPath)
  const onDirtyChange = useCallback((dirty: boolean) => { dirtyRef.current = dirty }, [])
  const leaveDialogRef = useRef<HTMLElement>(null)
  const closeDialogRef = useRef<HTMLElement>(null)
  useEffect(() => { document.title = path.startsWith('/p/') ? path.endsWith('/results') ? 'Итоги опроса — AnonPulse' : 'Голосование — AnonPulse' : path.endsWith('/results') ? 'Результаты — AnonPulse' : path.endsWith('/edit') || path.endsWith('/new') ? 'Конструктор — AnonPulse' : path === '/app/polls' || path === '/' ? 'Опросы — AnonPulse' : 'Опрос — AnonPulse' }, [path])
  useEffect(() => {
    if (!pendingPath) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingPath(null)
      if (event.key === 'Tab') {
        const buttons = leaveDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
        if (!buttons?.length) return
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [pendingPath])
  useEffect(() => {
    if (!closingPollId) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setClosingPollId(null)
      if (event.key === 'Tab') {
        const buttons = closeDialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
        if (!buttons?.length) return
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [closingPollId])
  const saveDemoPoll = (form: BuilderForm, existing?: Poll) => {
    const saved = pollFromDemoForm(form, existing)
    setPolls(current => existing ? current.map(item => item.id === existing.id ? saved : item) : [saved, ...current])
    setNotices(current => ({ ...current, [saved.id]: existing ? 'Черновик обновлён только в деморежиме. После перезагрузки вернутся исходные данные.' : 'Черновик добавлен только в деморежиме. После перезагрузки он исчезнет.' }))
    dirtyRef.current = false
    goAnyway(`/app/polls/${saved.id}`)
  }
  const publishDemoPoll = (poll: Poll) => {
    if (poll.status !== 'draft') return
    setPolls(current => current.map(item => item.id === poll.id ? { ...item, status: 'open', publishedAt: new Date().toISOString() } : item))
    setResultsById(current => ({ ...current, [poll.id]: emptyDemoResults(poll) }))
    setNotices(current => ({ ...current, [poll.id]: 'Опрос открыт только в деморежиме. Голоса не записываются, после перезагрузки статус вернётся к исходному.' }))
  }
  const closeDemoPoll = () => {
    if (!closingPollId) return
    const id = closingPollId
    const poll = polls.find(item => item.id === id)
    if (poll?.status !== 'open') { setClosingPollId(null); return }
    setPolls(current => current.map(item => item.id === id ? { ...item, status: 'closed', closedAt: new Date().toISOString() } : item))
    setResultsById(current => ({ ...current, [id]: { ...(current[id] ?? emptyDemoResults(poll)), status: 'closed', resultsType: 'final' } }))
    setNotices(current => ({ ...current, [id]: 'Опрос закрыт только в деморежиме. Итоги доступны студенту, после перезагрузки статус вернётся к исходному.' }))
    setClosingPollId(null)
  }
  const parts = path.split('/').filter(Boolean)
  const publicPoll = parts[0] === 'p' ? polls.find(item => item.id === parts[1]) : undefined
  const finalResults = publicFinalResults(publicPoll, resultsById[parts[1]])
  if (parts[0] === 'p' && parts.length === 3 && parts[2] === 'results') return <PublicResultsPage key={parts[1]} id={parts[1]} results={finalResults} decision={decisions[parts[1]]} navigate={navigate} />
  if (parts[0] === 'p' && parts.length === 2) return <PublicVotingPage key={parts[1]} id={parts[1]} poll={publicPoll?.status === 'open' ? publicPoll as PublicPoll : undefined} status={publicPoll?.status} hasFinalResults={Boolean(finalResults)} navigate={navigate} />
  const poll = parts[0] === 'app' && parts[1] === 'polls' && parts[2] ? polls.find(item => item.id === parts[2]) : undefined
  let content: ReactNode
  if (path === '/' || path === '/app/polls') content = <Dashboard polls={polls} navigate={navigate} />
  else if (path === '/app/polls/new') content = <BuilderPage key="new" mode="create" navigate={navigate} onDirtyChange={onDirtyChange} onDemoSave={form => saveDemoPoll(form)} />
  else if (poll && parts.length === 3) content = <DetailPage poll={poll} navigate={navigate} decision={decisions[poll.id]} onDemoPublish={() => publishDemoPoll(poll)} onRequestClose={() => setClosingPollId(poll.id)} notice={notices[poll.id]} />
  else if (poll && parts.length === 4 && parts[3] === 'results') content = <ResultsPage poll={poll} results={resultsById[poll.id]} navigate={navigate} decision={decisions[poll.id]} onDemoPublish={text => setDecisions(current => ({ ...current, [poll.id]: text }))} />
  else if (poll && parts.length === 4 && parts[3] === 'edit') content = poll.status === 'draft' ? <BuilderPage key={poll.id} mode="edit" poll={poll} navigate={navigate} onDirtyChange={onDirtyChange} onDemoSave={form => saveDemoPoll(form, poll)} /> : <EditUnavailable poll={poll} navigate={navigate} />
  else content = <NotFound navigate={navigate} />
  return <><Shell navigate={navigate}>{content}</Shell>{pendingPath && <div className="builder-modal-backdrop"><section ref={leaveDialogRef} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description"><span className="leave-dialog__icon"><Icon name="alert" size={22} /></span><h2 id="leave-dialog-title">Выйти без сохранения?</h2><p id="leave-dialog-description">Изменения в конструкторе существуют только на этой странице и будут потеряны.</p><div><button type="button" className="button button--check" autoFocus onClick={() => setPendingPath(null)}>Продолжить редактирование</button><button type="button" className="button button--danger" onClick={() => { const destination = pendingPath; dirtyRef.current = false; setPendingPath(null); goAnyway(destination) }}>Выйти без сохранения</button></div></section></div>}{closingPollId && <div className="builder-modal-backdrop"><section ref={closeDialogRef} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="close-dialog-title" aria-describedby="close-dialog-description"><span className="leave-dialog__icon"><Icon name="lock" size={22} /></span><h2 id="close-dialog-title">Завершить голосование в демо?</h2><p id="close-dialog-description">В текущей вкладке опрос станет закрытым, а студент увидит итоговые результаты. Ответы демо-голосования не учитываются. После перезагрузки исходный статус вернётся.</p><div><button type="button" className="button button--check" onClick={() => setClosingPollId(null)}>Оставить открытым</button><button type="button" className="button button--danger" onClick={closeDemoPoll}>Закрыть в демо</button></div></section></div>}</>
}
