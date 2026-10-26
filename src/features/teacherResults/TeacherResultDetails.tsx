import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { pollsApi } from '../../api/polls'
import { Icon } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import { FeedbackAnalysisPanel } from './FeedbackAnalysisPanel'
import { getQuestionType, getResponseMode, type IdentifiedSubmission, type PagedResponse, type Poll, type TestAttempt, type TextAnswer } from '../../types/polls'
import './teacherResults.css'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Сессия завершилась. Войдите снова.'
    if (error.status === 403 || error.status === 404) return 'Нет доступа к этим ответам или форма не найдена.'
    if (error.status === 409) return 'Ответы доступны после закрытия формы.'
    if (error.status === 429) return 'Слишком много запросов. Попробуйте позже.'
    if (error.status === null) return error.message
  }
  return 'Не удалось загрузить данные. Попробуйте снова.'
}

function usePaged<T>(key: string, enabled: boolean, page: number, load: (page: number, signal: AbortSignal) => Promise<PagedResponse<T>>) {
  const loadRef = useRef(load)
  loadRef.current = load
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<PagedResponse<T> | null>(null)
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setState('loading')
    setError('')
    loadRef.current(page, controller.signal).then(value => { setData(value); setState('ready') }).catch(cause => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setData(null)
      setState('error')
      setError(errorText(cause))
    })
    return () => controller.abort()
  }, [key, enabled, page, refresh])
  return { data, state, error, retry: () => setRefresh(value => value + 1) }
}

function PageControls({ page, totalPages, totalCount, onPage }: { page: number; totalPages: number; totalCount: number; onPage: (page: number) => void }) {
  if (totalCount === 0 || totalPages <= 1) return null
  return <nav className="teacher-pages" aria-label="Страницы результатов"><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}>Назад</button><span>Страница {page} из {totalPages}</span><button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Далее</button></nav>
}

function LoadArea({ state, error, retry, children }: { state: LoadState; error: string; retry: () => void; children: ReactNode }) {
  if (state === 'loading' || state === 'idle') return <p className="teacher-data-state" role="status">Загружаем ответы…</p>
  if (state === 'error') return <div className="teacher-data-state" role="alert"><p>{error}</p><button type="button" onClick={retry}>Повторить</button></div>
  return <>{children}</>
}

function TextAnswerList({ pollId, questionId, count }: { pollId: string; questionId: string; count: number }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const { data, state, error, retry } = usePaged<TextAnswer>(`${pollId}:${questionId}`, open, page, (value, signal) => pollsApi.textAnswers(pollId, questionId, value, signal))
  return <div className="teacher-private-card"><button className="teacher-private-card__toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>{count} текстовых ответов</span><span>{open ? 'Свернуть' : 'Читать ответы'} <Icon name={open ? 'up' : 'down'} size={16} /></span></button>{open && <div className="teacher-private-card__body"><LoadArea state={state} error={error} retry={retry}>{data?.items.length ? <ol className="teacher-text-list" start={(page - 1) * 20 + 1}>{data.items.map(item => <li key={item.id}>{item.text}</li>)}</ol> : <p className="teacher-data-state">Текстовых ответов пока нет.</p>}{data && <PageControls page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPage={setPage} />}</LoadArea></div>}</div>
}

function AnswerDetails({ poll, answers }: { poll: Poll; answers: IdentifiedSubmission['answers'] | TestAttempt['answers'] }) {
  return <ol className="teacher-answer-list">{[...poll.questions].sort((a, b) => a.position - b.position).map((question, index) => {
    const answer = answers.find(item => item.questionId === question.id)
    const selected = question.options.filter(option => answer?.selectedOptionIds.includes(option.id)).sort((a, b) => a.position - b.position)
    const graded = answer && 'gradingState' in answer && 'score' in answer && 'maximumScore' in answer ? answer : null
    return <li key={question.id}><span className="teacher-answer-list__number">{String(index + 1).padStart(2, '0')}</span><div><span className="teacher-answer-list__label">Вопрос</span><strong>{question.text}</strong><div className="teacher-answer-list__response"><span className="teacher-answer-list__label">Ответ студента</span><p>{getQuestionType(question) === 'text' ? answer?.text || 'Ответ не найден' : selected.length ? selected.map(option => option.text).join(', ') : 'Ответ не найден'}</p></div>{graded && <span className="teacher-answer-list__score">{graded.gradingState === 'pending' || graded.score === null ? 'Ожидает проверки' : `Начислено: ${graded.score} / ${graded.maximumScore}`}</span>}</div></li>
  })}</ol>
}

function pendingCount(attempt: TestAttempt) { return attempt.answers.filter(answer => answer.gradingState === 'pending').length }

function pendingLabel(count: number) {
  const last = count % 10
  const teens = count % 100 >= 11 && count % 100 <= 14
  return `${count} ${!teens && last === 1 ? 'ответ ожидает' : !teens && last >= 2 && last <= 4 ? 'ответа ожидают' : 'ответов ожидают'} проверки`
}

function IdentifiedSubmissions({ poll }: { poll: Poll }) {
  const [page, setPage] = useState(1)
  const { data, state, error, retry } = usePaged<IdentifiedSubmission>(poll.id, true, page, (value, signal) => pollsApi.submissions(poll.id, value, signal))
  return <section className="teacher-private-section" aria-labelledby="identified-submissions-title"><div className="section-title"><div><p className="eyebrow">ТОЛЬКО ДЛЯ ПРЕПОДАВАТЕЛЯ</p><h2 id="identified-submissions-title">Именные отправки</h2></div>{data && <span>{data.totalCount} участников</span>}</div><p className="teacher-private-intro">Имена указаны самими участниками и не подтверждают их личность.</p><LoadArea state={state} error={error} retry={retry}>{data?.items.length ? <div className="teacher-person-list">{data.items.map((item, index) => <details key={item.id} className="teacher-person"><summary><span className="teacher-person__index">{String((page - 1) * 20 + index + 1).padStart(2, '0')}</span><strong>{item.respondentName}</strong><span>Показать ответы</span><Icon name="down" size={17} /></summary><AnswerDetails poll={poll} answers={item.answers} /></details>)}</div> : <p className="teacher-data-state">Именных отправок пока нет.</p>}{data && <PageControls page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPage={setPage} />}</LoadArea></section>
}

export function SurveyPrivateResults({ poll, textQuestions }: { poll: Poll; textQuestions: Array<{ id: string; text: string; textPurpose?: string | null; textAnswerCount?: number }> }) {
  if (poll.status !== 'closed') return null
  return <div className="teacher-private-results">{textQuestions.length > 0 && <section className="teacher-private-section" aria-labelledby="text-answers-title"><div className="section-title"><div><p className="eyebrow">ТОЛЬКО ДЛЯ ПРЕПОДАВАТЕЛЯ</p><h2 id="text-answers-title">Текстовые ответы</h2></div></div><p className="teacher-private-intro">Отдельные ответы доступны после закрытия опроса. Анонимные ответы не связаны с именами.</p><div className="teacher-text-questions">{textQuestions.map((question, index) => <div key={question.id}><h3><span>{String(index + 1).padStart(2, '0')}</span>{question.text}</h3><TextAnswerList pollId={poll.id} questionId={question.id} count={question.textAnswerCount ?? 0} />{(question.textPurpose ?? poll.questions.find(item => item.id === question.id)?.textPurpose) === 'feedback' && (question.textAnswerCount ?? 0) > 0 && <FeedbackAnalysisPanel pollId={poll.id} questionId={question.id} answerCount={question.textAnswerCount ?? 0} />}</div>)}</div></section>}{getResponseMode(poll) === 'identified' && <IdentifiedSubmissions poll={poll} />}</div>
}

export function TestAttempts({ poll, navigate }: { poll: Poll; navigate: (to: string) => void }) {
  const [page, setPage] = useState(1)
  const { data, state, error, retry } = usePaged<TestAttempt>(poll.id, true, page, (value, signal) => pollsApi.testAttempts(poll.id, value, signal))

  return <div className="page page--results">
    <nav className="breadcrumbs" aria-label="Путь к странице">
      <AppLink to="/app/polls" navigate={navigate}>Опросы</AppLink><Icon name="chevronRight" size={15} />
      <AppLink to={`/app/polls/${poll.id}`} navigate={navigate}>{poll.title || poll.questions[0]?.text || 'Тест без названия'}</AppLink>
      <Icon name="chevronRight" size={15} /><span aria-current="page">Результаты</span>
    </nav>
    <div className="results-heading"><div><p className="eyebrow">ИТОГИ ТЕСТИРОВАНИЯ</p><h1>Результаты теста</h1><p>{poll.title || poll.questions[0]?.text || 'Тест без названия'}</p><span className="results-visibility"><Icon name="lock" size={15} />Доступны преподавателю после закрытия теста</span></div><span className="status status--closed"><span className="status__dot" />Завершён</span></div>
    <div className="teacher-test-summary"><div><strong>{data?.totalCount ?? '—'}</strong><span>попыток</span></div><div className="teacher-test-summary__scale">Шкала: <strong>{poll.testScale ?? '—'} баллов</strong></div><button type="button" onClick={retry} disabled={state === 'loading'}>{state === 'loading' ? 'Обновляем…' : 'Обновить'}</button></div>
    <section className="teacher-private-section" aria-labelledby="test-attempts-title">
      <div className="section-title"><div><p className="eyebrow">ОТВЕТЫ УЧАСТНИКОВ</p><h2 id="test-attempts-title">Попытки тестирования</h2></div></div>
      <LoadArea state={state} error={error} retry={retry}>
        {data?.items.length ? <div className="teacher-person-list">{data.items.map((item, index) => {
          const waiting = pendingCount(item)
          const final = item.isFinal && item.isFullyGraded && waiting === 0
          return <details key={item.id} className="teacher-person teacher-person--test">
            <summary>
              <span className="teacher-person__index">{String((page - 1) * 20 + index + 1).padStart(2, '0')}</span>
              <span className="teacher-person__identity"><strong>{item.respondentName}</strong><small>{item.respondentGroup}</small></span>
              <span className="teacher-person__result"><strong>{item.rawScore} / {item.maximumScore}</strong><small>начислено за проверенные задания</small><small>{waiting > 0 ? `Предварительный результат · ${pendingLabel(waiting)}` : item.normalizedScore === null ? 'Оценка пока недоступна' : final ? `Итоговая оценка: ${item.normalizedScore} / ${poll.testScale ?? '—'}` : `Предварительная оценка: ${item.normalizedScore} / ${poll.testScale ?? '—'}`}</small></span>
              <Icon name="down" size={17} />
            </summary>
            <div className="teacher-attempt-summary">
              <div><span>Начислено за проверенные задания</span><strong>{item.rawScore} / {item.maximumScore}</strong></div>
              <div><span>Состояние проверки</span><strong>{waiting > 0 ? pendingLabel(waiting) : item.isFullyGraded ? 'Все задания проверены' : 'Проверка не завершена'}</strong></div>
              <p>{item.normalizedScore === null ? 'Оценка пока недоступна.' : `${final ? 'Итоговая' : 'Предварительная'} оценка по шкале ${poll.testScale ?? '—'}: ${item.normalizedScore}.`}</p>
            </div>
            <AnswerDetails poll={poll} answers={item.answers} />
          </details>
        })}</div> : <p className="teacher-data-state">Попыток пока нет.</p>}
        {data && <PageControls page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPage={setPage} />}
      </LoadArea>
    </section>
  </div>
}
