import { useEffect, useState } from 'react'
import { pollsApi } from '../../api/polls'
import { ApiError } from '../../api/client'
import { ResultDistribution } from '../../components/ResultDistribution'
import { Icon } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import type { PollResults } from '../../types/polls'
import { PublicFrame } from './PublicFrame'
import './publicResults.css'

const participantLabel = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'участник' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'участника' : 'участников'

export default function PublicResultsPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [results, setResults] = useState<PollResults | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'missing' | 'error'>('loading')
  const [decision, setDecision] = useState<string | null>(null)
  const [decisionStatus, setDecisionStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setResults(null)
    setDecision(null)
    setDecisionStatus('loading')
    pollsApi.results(id, controller.signal).then(async value => {
      if (controller.signal.aborted) return
      if (value.status !== 'closed' || value.resultsType !== 'final') { setStatus('unavailable'); return }
      setResults(value)
      setStatus('ready')
      try {
        const published = await pollsApi.decision(id, controller.signal)
        if (!controller.signal.aborted) { setDecision(published.text); setDecisionStatus('ready') }
      } catch (error) {
        if (controller.signal.aborted) return
        setDecisionStatus(error instanceof ApiError && error.status === 404 ? 'ready' : 'error')
      }
    }).catch(error => {
      if (controller.signal.aborted) return
      setStatus(error instanceof ApiError && error.status === 404 ? 'missing' : error instanceof ApiError && [401, 403, 409].includes(error.status ?? 0) ? 'unavailable' : 'error')
    })
    return () => controller.abort()
  }, [id, attempt])

  if (status !== 'ready' || !results) return <PublicFrame id={id} compact><section className="vote-state public-results-unavailable" aria-labelledby="public-results-unavailable-title"><span className="vote-state__icon"><Icon name={status === 'loading' ? 'barChart' : status === 'missing' ? 'search' : 'lock'} size={25} /></span><p className="vote-eyebrow">{status === 'loading' ? 'ЗАГРУЗКА' : 'ИТОГИ НЕДОСТУПНЫ'}</p><h1 id="public-results-unavailable-title">{status === 'loading' ? 'Загружаем результаты' : status === 'missing' ? 'Опрос не найден' : status === 'error' ? 'Не удалось загрузить итоги' : 'Итоги пока недоступны'}</h1><div className="vote-state__body"><p>{status === 'loading' ? 'Получаем агрегированные результаты с сервера.' : status === 'missing' ? 'Проверьте ссылку на опрос.' : status === 'error' ? 'Проверьте соединение и попробуйте ещё раз.' : 'Студенты увидят итоговые результаты после закрытия опроса.'}</p>{status === 'unavailable' && <p className="vote-state__aside">Промежуточная статистика активного опроса доступна только преподавателю и администратору.</p>}</div>{status === 'error' && <button type="button" className="vote-button vote-button--primary" onClick={() => setAttempt(value => value + 1)}>Повторить</button>}</section></PublicFrame>

  return <PublicFrame id={id}><div className="public-results"><AppLink to={`/p/${id}`} navigate={navigate} className="public-results__back"><Icon name="arrowLeft" size={16} />К странице опроса</AppLink><div className="public-results__heading"><div><p className="vote-eyebrow">ИТОГИ ОБРАТНОЙ СВЯЗИ</p><h1>Итоги опроса</h1><p>Голосование завершено. Ниже — только общие результаты, без индивидуальных ответов.</p></div><span className="public-results__status"><Icon name="check" size={15} />Завершён</span></div>
    <section className="public-results__summary" aria-label="Участники опроса"><div><span className="public-results__count">{results.totalParticipants}</span><div><strong>{participantLabel(results.totalParticipants)}</strong><p>{results.totalParticipants === 0 ? 'пока нет ответов' : 'ответили на этот опрос'}</p></div></div><span>{results.questions.length} {results.questions.length === 1 ? 'вопрос' : results.questions.length < 5 ? 'вопроса' : 'вопросов'}</span></section>
    <section className="public-results__distribution" aria-labelledby="public-results-questions"><div className="public-results__section-head"><p className="vote-eyebrow">РАСПРЕДЕЛЕНИЕ ОТВЕТОВ</p><h2 id="public-results-questions">Результаты по вопросам</h2></div>{results.totalParticipants === 0 && <div className="zero-results"><Icon name="barChart" size={19} /><span>Ответов нет. Для всех вариантов показано 0 голосов.</span></div>}<ResultDistribution questions={results.questions} totalParticipants={results.totalParticipants} /></section>
    <section className="public-results__decision" aria-labelledby="public-results-decision"><span className="public-results__decision-icon"><Icon name={decision ? 'check' : 'info'} size={20} /></span><div><p className="vote-eyebrow">ЧТО ИЗМЕНИТСЯ</p><h2 id="public-results-decision">Решение преподавателя</h2>{decision ? <p className="public-results__decision-text">{decision}</p> : <p className="public-results__decision-empty" role={decisionStatus === 'loading' ? 'status' : undefined}>{decisionStatus === 'loading' ? 'Загружаем решение преподавателя…' : decisionStatus === 'error' ? 'Не удалось загрузить решение. Обновите страницу позже.' : 'Решение по итогам опроса пока не опубликовано. Здесь появится текст преподавателя, когда он будет готов.'}</p>}</div></section>
  </div></PublicFrame>
}
