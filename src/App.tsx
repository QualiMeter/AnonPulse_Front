import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Decision, Poll, PollResults, PollStatus } from './types/polls'
import { Icon } from './components/Icon'
import { Brand } from './components/Brand'
import { AppLink } from './components/AppLink'
import { ResultDistribution } from './components/ResultDistribution'
import type { BuilderForm } from './features/pollBuilder/model'
import BuilderPage from './features/pollBuilder/BuilderPage'
import PublicVotingPage from './features/publicVoting/PublicVotingPage'
import PublicResultsPage from './features/publicVoting/PublicResultsPage'
import DecisionPanel from './features/decisions/DecisionPanel'
import LoginPage from './features/auth/LoginPage'
import { authApi, type CurrentUser } from './api/auth'
import { ApiError } from './api/client'
import { pollsApi, type PollDraft } from './api/polls'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(value: string) { return dateFormatter.format(new Date(value)) }
function formatShortDate(value: string) { return shortDateFormatter.format(new Date(value)) }
function pluralQuestions(count: number) { return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'вопрос' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'вопроса' : 'вопросов'}` }
function participantNoun(count: number) { return count % 10 === 1 && count % 100 !== 11 ? 'участник' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'участника' : 'участников' }
function pollTitle(poll: Poll) { return poll.title?.trim() || poll.questions[0]?.text || 'Опрос без названия' }
function apiMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Сессия завершилась. Войдите снова.'
    if (error.status === 403) return 'У вас нет доступа к этим данным.'
    if (error.status === 404) return 'Опрос не найден или недоступен.'
    if (error.status === 409) return 'Действие недоступно в текущем состоянии опроса.'
    if (error.status === 429) return 'Слишком много запросов. Попробуйте позже.'
    if (error.status === null) return error.message
    if (error.status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'
  }
  return 'Не удалось получить данные. Попробуйте снова.'
}

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
    setPath(window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function navigate(to: string) {
    if (pathRef.current === to) return
    if (dirtyRef.current) { onBlocked(to); return }
    goAnyway(to)
  }
  return { path, navigate, goAnyway }
}

function Shell({ children, navigate, user, onLogout, logoutBusy, logoutError }: { children: ReactNode; navigate: (to: string) => void; user: CurrentUser; onLogout: () => void; logoutBusy: boolean; logoutError: string }) {
  return <>
    <header className="site-header">
      <div className="site-header__inner">
        <AppLink to="/app/polls" navigate={navigate} className="brand-link" ariaLabel="AnonPulse — к списку опросов"><Brand /></AppLink>
        <span className="header-divider" />
        <span className="workspace-name">Пространство преподавателя</span>
        <div className="header-right"><span className="avatar" aria-label={`Выполнен вход: ${user.email}`}>{user.email.charAt(0).toLocaleUpperCase('ru')}</span><button type="button" className="header-logout" onClick={onLogout} disabled={logoutBusy}>{logoutBusy ? 'Выходим…' : 'Выйти'}</button></div>
      </div>
    </header>
    <div className="app-layout">
      <aside className="side-nav" aria-label="Навигация">
        <span className="side-nav__eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <AppLink to="/app/polls" navigate={navigate} className="side-nav__item side-nav__item--active"><Icon name="layers" size={19} /><span>Опросы</span></AppLink>
        <div className="side-nav__footer"><span className="side-nav__footer-icon"><Icon name="info" size={17} /></span><p>Обратная связь<br />от опроса до решения</p></div>
      </aside>
      <main className="main-content" id="main-content">{logoutError && <p className="session-error" role="alert">{logoutError}</p>}{children}</main>
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
      <div className="page-heading__action"><AppLink to="/app/polls/new" navigate={navigate} className="button button--primary"><Icon name="plus" size={18} />Создать опрос</AppLink></div>
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
      </div> : <div className="empty-state"><div className="empty-state__icon"><Icon name={polls.length ? 'search' : 'layers'} size={24} /></div><h3>{polls.length ? 'Ничего не найдено' : 'Пока нет опросов'}</h3><p>{polls.length ? 'Попробуйте изменить запрос или выбрать другой статус.' : 'Создайте первый опрос, чтобы начать собирать обратную связь.'}</p>{polls.length ? <button type="button" className="text-button" onClick={() => { setFilter('all'); setSearch('') }}>Сбросить фильтры <Icon name="arrowRight" size={16} /></button> : <AppLink to="/app/polls/new" navigate={navigate} className="button button--dark">Создать опрос</AppLink>}</div>}
    </section>
  </div>
}

function Breadcrumbs({ poll, navigate, current }: { poll?: Poll; navigate: (to: string) => void; current?: string }) {
  return <nav className="breadcrumbs" aria-label="Путь к странице"><AppLink to="/app/polls" navigate={navigate}>Опросы</AppLink>{poll && <><Icon name="chevronRight" size={15} />{current ? <AppLink to={`/app/polls/${poll.id}`} navigate={navigate}>{pollTitle(poll)}</AppLink> : <span aria-current="page">{pollTitle(poll)}</span>}</>}{current && <><Icon name="chevronRight" size={15} /><span aria-current="page">{current}</span></>}</nav>
}

function DetailPage({ poll, navigate, decision, onPublish, onRequestClose, notice, actionBusy, actionError }: { poll: Poll; navigate: (to: string) => void; decision?: string; onPublish: () => void; onRequestClose: () => void; notice?: string; actionBusy: boolean; actionError?: string }) {
  const hasResults = poll.status !== 'draft'
  const [copyFeedback, setCopyFeedback] = useState('')
  async function copyVotingLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${poll.id}`)
      setCopyFeedback('Ссылка скопирована.')
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
        {poll.status === 'draft' && <><AppLink to={`/app/polls/${poll.id}/edit`} navigate={navigate} className="button button--dark action-card__primary"><Icon name="edit" size={17} />Редактировать черновик<Icon name="arrowRight" size={18} /></AppLink><div className="future-actions"><button type="button" onClick={onPublish} disabled={actionBusy}><Icon name="check" size={17} />{actionBusy ? 'Публикуем…' : 'Опубликовать'}</button></div></>}
        {poll.status === 'open' && <div className="future-actions"><AppLink to={`/p/${poll.id}`} navigate={navigate}><Icon name="eye" size={17} />Открыть страницу голосования</AppLink><button type="button" onClick={copyVotingLink}><Icon name="link" size={17} />Скопировать ссылку</button><button type="button" onClick={onRequestClose} disabled={actionBusy}><Icon name="lock" size={17} />Закрыть опрос</button></div>}
        {copyFeedback && <p className="action-card__feedback" role="status">{copyFeedback}</p>}
        {actionError && <p className="action-card__feedback" role="alert">{actionError}</p>}
        <p className="action-card__note">{poll.status === 'closed' ? 'Этот опрос больше не принимает ответы.' : poll.status === 'open' ? 'Отправьте ссылку студентам. После закрытия новые ответы не принимаются.' : 'После публикации редактирование будет недоступно.'}</p>
      </section>
      <section className="aside-card info-card"><h2>Об опросе</h2><dl><div><dt><Icon name="calendar" size={17} />Создан</dt><dd>{formatDate(poll.createdAt)}</dd></div>{poll.publishedAt && <div><dt><Icon name="check" size={17} />Опубликован</dt><dd>{formatDate(poll.publishedAt)}</dd></div>}{poll.closedAt && <div><dt><Icon name="lock" size={17} />Завершён</dt><dd>{formatDate(poll.closedAt)}</dd></div>}<div><dt><Icon name="layers" size={17} />Вопросов</dt><dd>{poll.questions.length}</dd></div></dl></section>
      {decision && <section className="aside-card decision-card"><p className="eyebrow">ЧТО ИЗМЕНИТСЯ</p><h2>Решение преподавателя</h2><p>{decision}</p></section>}</aside>
    </div>
  </div>
}

function ResultsPage({ poll, results, navigate, decision, decisionStatus, onRetryDecision, onPublishDecision, onRefresh, refreshing }: { poll: Poll; results?: PollResults; navigate: (to: string) => void; decision?: string; decisionStatus?: 'idle' | 'loading' | 'ready' | 'error'; onRetryDecision?: () => void; onPublishDecision: (text: string) => Promise<void>; onRefresh: () => void; refreshing: boolean }) {
  if (!results) return <div className="page"><Breadcrumbs poll={poll} navigate={navigate} current="Результаты" /><div className="state-panel"><div className="state-panel__icon"><Icon name="lock" size={25} /></div><h1>Результаты пока недоступны</h1><p>Статистика появится после публикации опроса.</p><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />Вернуться к опросу</AppLink></div></div>

  return <div className="page page--results">
    <Breadcrumbs poll={poll} navigate={navigate} current="Результаты" />
    <div className="results-heading"><div><p className="eyebrow">{results.resultsType === 'interim' ? 'ПРОМЕЖУТОЧНЫЕ РЕЗУЛЬТАТЫ' : 'ИТОГОВЫЕ РЕЗУЛЬТАТЫ'}</p><h1>Результаты опроса</h1><p>{pollTitle(poll)}</p><span className="results-visibility"><Icon name={results.resultsType === 'interim' ? 'lock' : 'link'} size={15} />{results.resultsType === 'interim' ? 'Видны только преподавателю и администратору' : 'Доступны всем после закрытия опроса'}</span></div><div><StatusBadge status={poll.status} /><button type="button" className="header-logout" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Обновляем…' : 'Обновить результаты'}</button></div></div>
    <div className="results-summary"><div className="results-summary__count"><span>{results.totalParticipants}</span><div><strong>{participantNoun(results.totalParticipants)}</strong><p>{results.totalParticipants === 0 ? 'Пока нет ответов' : 'ответили на этот опрос'}</p></div></div><div className="results-summary__aside"><span>{pluralQuestions(results.questions.length)}</span><p>{results.resultsType === 'interim' ? 'Промежуточные результаты — только для преподавателя. Данные могут измениться.' : 'Итоговые результаты доступны по ссылке после закрытия.'}</p></div></div>
    <div className="results-layout"><div className="results-main"><div className="section-title"><div><p className="eyebrow">РАСПРЕДЕЛЕНИЕ ОТВЕТОВ</p><h2>По каждому вопросу</h2></div></div>
      {results.totalParticipants === 0 && <div className="zero-results"><Icon name="barChart" size={20} /><span>Ответов пока нет. Распределение появится после первого участия.</span></div>}
      <ResultDistribution questions={results.questions} totalParticipants={results.totalParticipants} />
    </div><aside className="results-aside">{poll.status === 'closed' ? <>{decisionStatus === 'ready' ? <DecisionPanel key={poll.id} text={decision} onPublish={onPublishDecision} /> : <section className="aside-card decision-card decision-card--results"><p className="eyebrow">ПОСЛЕ ОПРОСА</p><h2>Решение преподавателя</h2><p className="decision-card__empty" role={decisionStatus === 'loading' ? 'status' : undefined}>{decisionStatus === 'error' ? 'Не удалось загрузить опубликованное решение.' : 'Загружаем решение…'}</p>{decisionStatus === 'error' && <button className="decision-editor__button" type="button" onClick={onRetryDecision}>Повторить</button>}</section>}<AppLink to={`/p/${poll.id}/results`} navigate={navigate} className="results-public-link"><Icon name="eye" size={17} />Публичный вид итогов<Icon name="arrowRight" size={16} /></AppLink></> : <section className="aside-card decision-card decision-card--results"><p className="eyebrow">ПОСЛЕ ОПРОСА</p><h2>Решение преподавателя</h2><p className="decision-card__empty">Решение можно опубликовать после закрытия опроса.</p></section>}<div className="results-aside__hint"><Icon name="info" size={18} /><p>Проценты рассчитаны отдельно для каждого вопроса и могут не складываться ровно в 100% из-за округления.</p></div></aside></div>
  </div>
}

function NotFound({ navigate }: { navigate: (to: string) => void }) {
  return <div className="page"><div className="state-panel"><div className="state-panel__icon"><Icon name="search" size={24} /></div><h1>Опрос не найден</h1><p>Проверьте ссылку или вернитесь к списку опросов.</p><AppLink to="/app/polls" navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />К списку опросов</AppLink></div></div>
}

function EditUnavailable({ poll, navigate }: { poll: Poll; navigate: (to: string) => void }) {
  return <div className="page"><Breadcrumbs poll={poll} navigate={navigate} current="Редактирование" /><div className="state-panel"><div className="state-panel__icon"><Icon name="lock" size={24} /></div><h1>Редактирование недоступно</h1><p>Изменять можно только черновики. Опубликованный или завершённый опрос остаётся без изменений.</p><AppLink to={`/app/polls/${poll.id}`} navigate={navigate} className="button button--dark"><Icon name="arrowLeft" size={18} />К опросу</AppLink></div></div>
}

function ResourceState({ title, message, retry, navigate, loading = false }: { title: string; message: string; retry?: () => void; navigate: (to: string) => void; loading?: boolean }) {
  return <div className="page"><div className="state-panel" role={loading ? 'status' : undefined}><div className="state-panel__icon"><Icon name={loading ? 'layers' : 'alert'} size={24} /></div><h1>{title}</h1><p>{message}</p><div className="resource-actions">{retry && <button type="button" className="button button--dark" onClick={retry}>Повторить</button>}<AppLink to="/app/polls" navigate={navigate} className="button button--check">К списку опросов</AppLink></div></div></div>
}

function draftFromForm(form: BuilderForm): PollDraft {
  return {
    title: form.title.trim() || null,
    questions: form.questions.map(question => ({
      text: question.text.trim(),
      options: question.options.map(option => option.text.trim()),
    })),
  }
}

export default function App() {
  const dirtyRef = useRef(false)
  const [auth, setAuth] = useState<{ status: 'unchecked' | 'checking' | 'authenticated' | 'anonymous' | 'error' | 'forbidden'; user?: CurrentUser }>({ status: 'unchecked' })
  const [authAttempt, setAuthAttempt] = useState(0)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [listRefresh, setListRefresh] = useState(0)
  const [listError, setListError] = useState('')
  const [detail, setDetail] = useState<{ id: string; status: 'loading' | 'ready' | 'error'; poll?: Poll; error?: string } | null>(null)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const [results, setResults] = useState<PollResults | null>(null)
  const [resultsStatus, setResultsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [resultsError, setResultsError] = useState('')
  const [resultsRefresh, setResultsRefresh] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [decisionStatus, setDecisionStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [decisionRefresh, setDecisionRefresh] = useState(0)
  const [decisionError, setDecisionError] = useState('')
  const [notices, setNotices] = useState<Record<string, string>>({})
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [closingPollId, setClosingPollId] = useState<string | null>(null)
  const { path, navigate, goAnyway } = usePathname(dirtyRef, setPendingPath)
  const isPublicPage = /^\/p\/[^/]+(?:\/results)?$/.test(path)
  const isLoginPage = path === '/login'
  const parts = path.split('/').filter(Boolean)
  const activePollId = parts[0] === 'app' && parts[1] === 'polls' && parts[2] && parts[2] !== 'new' ? parts[2] : null
  const resultsRoute = parts[3] === 'results'
  useEffect(() => {
    const expired = () => setAuth({ status: 'anonymous' })
    window.addEventListener('anonpulse:session-expired', expired)
    return () => window.removeEventListener('anonpulse:session-expired', expired)
  }, [])
  useEffect(() => {
    if (isPublicPage || auth.status !== 'unchecked') return
    const controller = new AbortController()
    setAuth({ status: 'checking' })
    authApi.me(controller.signal).then(user => setAuth(user.roles.includes('teacher') ? { status: 'authenticated', user } : { status: 'forbidden', user })).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setAuth({ status: error instanceof ApiError && error.status === 401 ? 'anonymous' : 'error' })
    })
    return () => controller.abort()
  }, [isPublicPage, authAttempt])
  useEffect(() => {
    if (!isPublicPage && !isLoginPage && auth.status === 'anonymous') {
      goAnyway(`/login?next=${encodeURIComponent(path)}`)
    }
  }, [auth.status, isPublicPage, isLoginPage, path])
  useEffect(() => {
    if (auth.status !== 'authenticated' || (path !== '/' && path !== '/app/polls')) return
    const controller = new AbortController()
    setListStatus('loading')
    setListError('')
    pollsApi.list(controller.signal).then(items => { setPolls(items); setListStatus('ready') }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setListError(apiMessage(error))
      setListStatus('error')
    })
    return () => controller.abort()
  }, [auth.status, path, listRefresh])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !activePollId) return
    const controller = new AbortController()
    setDetail({ id: activePollId, status: 'loading' })
    pollsApi.detail(activePollId, controller.signal).then(poll => {
      setDetail({ id: activePollId, status: 'ready', poll })
      setPolls(current => current.some(item => item.id === poll.id) ? current.map(item => item.id === poll.id ? poll : item) : [poll, ...current])
    }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setDetail({ id: activePollId, status: 'error', error: apiMessage(error) })
    })
    return () => controller.abort()
  }, [auth.status, activePollId, detailRefresh, path])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !activePollId || !resultsRoute || detail?.id !== activePollId || detail.poll?.status === 'draft' || detail.status !== 'ready') return
    const controller = new AbortController()
    setResults(null)
    setResultsStatus('loading')
    setResultsError('')
    pollsApi.results(activePollId, controller.signal, true).then(value => { setResults(value); setResultsStatus('ready') }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setResultsStatus('error'); setResultsError(apiMessage(error))
    })
    return () => controller.abort()
  }, [auth.status, activePollId, resultsRoute, detail?.id, detail?.status, detail?.poll?.status, resultsRefresh])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !activePollId || detail?.id !== activePollId || detail.poll?.status !== 'closed' || detail.status !== 'ready') return
    const controller = new AbortController()
    setDecision(null)
    setDecisionError('')
    setDecisionStatus('loading')
    pollsApi.decision(activePollId, controller.signal).then(value => { setDecision(value); setDecisionStatus('ready') }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof ApiError && error.status === 404) { setDecisionStatus('ready'); return }
      setDecisionStatus('error')
      setDecisionError(apiMessage(error))
    })
    return () => controller.abort()
  }, [auth.status, activePollId, detail?.id, detail?.status, detail?.poll?.status, decisionRefresh])
  const onSignedIn = (user: CurrentUser) => {
    setAuth({ status: 'authenticated', user })
    const requested = new URLSearchParams(window.location.search).get('next')
    goAnyway(requested?.startsWith('/app/') || requested === '/' ? requested : '/app/polls')
  }
  const performLogout = async () => {
    setLogoutError('')
    setLogoutBusy(true)
    try {
      await authApi.logout()
      dirtyRef.current = false
      setAuth({ status: 'anonymous' })
      goAnyway('/login')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        dirtyRef.current = false
        setAuth({ status: 'anonymous' })
        goAnyway('/login')
      } else setLogoutError(error instanceof ApiError && error.status === null ? error.message : 'Не удалось выйти. Попробуйте снова.')
    } finally { setLogoutBusy(false) }
  }
  const onLogout = () => {
    if (dirtyRef.current) setPendingPath('__logout__')
    else void performLogout()
  }
  const onDirtyChange = useCallback((dirty: boolean) => { dirtyRef.current = dirty }, [])
  const leaveDialogRef = useRef<HTMLElement>(null)
  const closeDialogRef = useRef<HTMLElement>(null)
  useEffect(() => { document.title = path === '/login' ? 'Вход — AnonPulse' : path.startsWith('/p/') ? path.endsWith('/results') ? 'Итоги опроса — AnonPulse' : 'Голосование — AnonPulse' : path.endsWith('/results') ? 'Результаты — AnonPulse' : path.endsWith('/edit') || path.endsWith('/new') ? 'Конструктор — AnonPulse' : path === '/app/polls' || path === '/' ? 'Опросы — AnonPulse' : 'Опрос — AnonPulse' }, [path])
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
  const savePoll = async (form: BuilderForm, existing?: Poll) => {
    const body = draftFromForm(form)
    const saved = existing ? await pollsApi.update(existing.id, body) : await pollsApi.create(body)
    setPolls(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
    setDetail({ id: saved.id, status: 'ready', poll: saved })
    setNotices(current => ({ ...current, [saved.id]: existing ? 'Черновик обновлён на сервере.' : 'Опрос создан на сервере как черновик.' }))
    return saved.id
  }
  const publishPoll = async (poll: Poll) => {
    if (poll.status !== 'draft' || actionBusy) return
    setActionBusy(true); setActionError('')
    try {
      const published = await pollsApi.publish(poll.id)
      setPolls(current => current.map(item => item.id === poll.id ? published : item))
      setDetail({ id: poll.id, status: 'ready', poll: published })
      setNotices(current => ({ ...current, [poll.id]: 'Опрос опубликован и принимает ответы.' }))
    } catch (error) { setActionError(apiMessage(error)) }
    finally { setActionBusy(false) }
  }
  const closePoll = async () => {
    if (!closingPollId || actionBusy) return
    const id = closingPollId
    setActionBusy(true); setActionError('')
    try {
      const closed = await pollsApi.close(id)
      setPolls(current => current.map(item => item.id === id ? closed : item))
      setDetail({ id, status: 'ready', poll: closed })
      setResults(null); setResultsStatus('idle')
      setNotices(current => ({ ...current, [id]: 'Опрос закрыт. Итоговые результаты доступны по публичной ссылке.' }))
      setClosingPollId(null)
    } catch (error) { setActionError(apiMessage(error)); setClosingPollId(null) }
    finally { setActionBusy(false) }
  }
  const publishDecision = async (id: string, text: string) => {
    const saved = await pollsApi.putDecision(id, text)
    setDecision(saved)
    setDecisionStatus('ready')
  }
  if (parts[0] === 'p' && parts.length === 3 && parts[2] === 'results') return <PublicResultsPage key={parts[1]} id={parts[1]} navigate={navigate} />
  if (parts[0] === 'p' && parts.length === 2) return <PublicVotingPage key={parts[1]} id={parts[1]} navigate={navigate} />
  if (isLoginPage) return auth.status === 'authenticated' ? <div className="auth-route-state"><p>Сессия активна.</p><button className="button button--primary" onClick={() => goAnyway('/app/polls')}>Открыть кабинет</button></div> : auth.status === 'unchecked' || auth.status === 'checking' ? <div className="auth-route-state" role="status">Проверяем сессию…</div> : <LoginPage onSignedIn={onSignedIn} />
  if (auth.status === 'unchecked' || auth.status === 'checking' || auth.status === 'anonymous') return <div className="auth-route-state" role="status">Проверяем сессию…</div>
  if (auth.status === 'forbidden') return <div className="auth-route-state"><Brand /><h1>Нет доступа к кабинету преподавателя</h1><p>Эта учётная запись не имеет роли преподавателя.</p><button type="button" className="button button--primary" onClick={onLogout} disabled={logoutBusy}>Выйти</button>{logoutError && <p role="alert">{logoutError}</p>}</div>
  if (auth.status === 'error' || !auth.user) return <div className="auth-route-state"><Brand /><h1>Не удалось проверить доступ</h1><p>Кабинет откроется после успешной проверки серверной сессии.</p><button type="button" className="button button--primary" onClick={() => { setAuth({ status: 'unchecked' }); setAuthAttempt(value => value + 1) }}>Повторить проверку</button><button type="button" className="header-logout" onClick={() => goAnyway('/login')}>Перейти ко входу</button></div>
  const poll = activePollId && detail?.id === activePollId && detail.status === 'ready' ? detail.poll : undefined
  let content: ReactNode
  if (path === '/' || path === '/app/polls') content = listStatus === 'error' ? <ResourceState title="Не удалось загрузить опросы" message={listError} retry={() => setListRefresh(value => value + 1)} navigate={navigate} /> : listStatus !== 'ready' ? <ResourceState title="Загружаем опросы" message="Получаем ваши опросы с сервера." navigate={navigate} loading /> : <Dashboard polls={polls} navigate={navigate} />
  else if (path === '/app/polls/new') content = <BuilderPage key="new" mode="create" navigate={navigate} onDirtyChange={onDirtyChange} onSave={form => savePoll(form)} />
  else if (activePollId && detail?.id === activePollId && detail.status === 'error') content = <ResourceState title="Не удалось открыть опрос" message={detail.error ?? 'Повторите попытку.'} retry={() => setDetailRefresh(value => value + 1)} navigate={navigate} />
  else if (activePollId && !poll) content = <ResourceState title="Загружаем опрос" message="Получаем актуальные данные с сервера." navigate={navigate} loading />
  else if (poll && parts.length === 3) content = <DetailPage poll={poll} navigate={navigate} decision={decision?.pollId === poll.id ? decision.text : undefined} onPublish={() => void publishPoll(poll)} onRequestClose={() => setClosingPollId(poll.id)} notice={notices[poll.id]} actionBusy={actionBusy} actionError={actionError} />
  else if (poll && parts.length === 4 && parts[3] === 'results') content = poll.status === 'draft' ? <ResultsPage poll={poll} navigate={navigate} onPublishDecision={text => publishDecision(poll.id, text)} onRefresh={() => setResultsRefresh(value => value + 1)} refreshing={false} /> : resultsStatus === 'error' ? <ResourceState title="Не удалось загрузить результаты" message={resultsError} retry={() => setResultsRefresh(value => value + 1)} navigate={navigate} /> : resultsStatus !== 'ready' ? <ResourceState title="Загружаем результаты" message="Получаем агрегированные ответы с сервера." navigate={navigate} loading /> : <><ResultsPage poll={poll} results={results ?? undefined} navigate={navigate} decision={decision?.pollId === poll.id ? decision.text : undefined} decisionStatus={decisionStatus} onRetryDecision={() => setDecisionRefresh(value => value + 1)} onPublishDecision={text => publishDecision(poll.id, text)} onRefresh={() => setResultsRefresh(value => value + 1)} refreshing={false} />{decisionError && <p className="session-error" role="alert">Не удалось загрузить решение: {decisionError}</p>}</>
  else if (poll && parts.length === 4 && parts[3] === 'edit') content = poll.status === 'draft' ? <BuilderPage key={poll.id} mode="edit" poll={poll} navigate={navigate} onDirtyChange={onDirtyChange} onSave={form => savePoll(form, poll)} /> : <EditUnavailable poll={poll} navigate={navigate} />
  else content = <NotFound navigate={navigate} />
  return <>
    <Shell navigate={navigate} user={auth.user} onLogout={onLogout} logoutBusy={logoutBusy} logoutError={logoutError}>{content}</Shell>
    {pendingPath && <div className="builder-modal-backdrop"><section ref={leaveDialogRef} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description"><span className="leave-dialog__icon"><Icon name="alert" size={22} /></span><h2 id="leave-dialog-title">Выйти без сохранения?</h2><p id="leave-dialog-description">Изменения в конструкторе будут потеряны.</p><div><button type="button" className="button button--check" autoFocus onClick={() => setPendingPath(null)}>Продолжить редактирование</button><button type="button" className="button button--danger" onClick={() => { const destination = pendingPath; setPendingPath(null); if (destination === '__logout__') void performLogout(); else { dirtyRef.current = false; goAnyway(destination) } }}>Выйти без сохранения</button></div></section></div>}
    {closingPollId && <div className="builder-modal-backdrop"><section ref={closeDialogRef} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="close-dialog-title" aria-describedby="close-dialog-description"><span className="leave-dialog__icon"><Icon name="lock" size={22} /></span><h2 id="close-dialog-title">Закрыть опрос?</h2><p id="close-dialog-description">После закрытия студенты больше не смогут голосовать. Итоговые результаты станут публичными. Это действие нельзя отменить.</p>{actionError && <p role="alert">{actionError}</p>}<div><button type="button" className="button button--check" onClick={() => setClosingPollId(null)} disabled={actionBusy}>Оставить открытым</button><button type="button" className="button button--danger" onClick={() => void closePoll()} disabled={actionBusy}>{actionBusy ? 'Закрываем…' : 'Закрыть опрос'}</button></div></section></div>}
  </>
}
