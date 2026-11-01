import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { pollsApi } from '../../api/polls'
import type { KnowledgeJob, KnowledgeSuggestion } from '../../types/polls'

function message(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось получить предложения ИИ.'
  if (error.problem?.code === 'knowledge_grading_disabled' || error.status === 503) return 'ИИ-проверка знаний отключена на сервере.'
  if (error.problem?.code === 'no_pending_answers') return 'Непроверенных ответов больше нет.'
  if (error.status === 413) return 'Объём ответов превышает лимит обработки.'
  if (error.status === 429) return 'Повтор пока ограничен. Попробуйте позже.'
  if (error.status === 401) return 'Сессия завершилась. Войдите снова.'
  if (error.status === 403) return 'Нет доступа к проверке этого теста.'
  if (error.status === 404) return 'Тест, вопрос или задание ИИ не найдены.'
  if (error.status === 409) return 'Проверка недоступна в текущем состоянии теста.'
  if (error.status === null) return error.message
  return 'Не удалось получить предложения ИИ.'
}

export function KnowledgeGradingPanel({ pollId, questionId, questionText, pending, onSuggestions }: { pollId: string; questionId: string; questionText: string; pending: number; onSuggestions: (items: KnowledgeSuggestion[]) => void }) {
  const [job, setJob] = useState<KnowledgeJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [retryLimit, setRetryLimit] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    pollsApi.knowledgeJob(pollId, questionId, controller.signal).then(value => { setJob(value); setError(''); setLoading(false) }).catch(cause => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      if (!(cause instanceof ApiError && cause.status === 404 && cause.problem?.code === 'knowledge_grading_not_found')) setError(message(cause))
      setLoading(false)
    })
    return () => controller.abort()
  }, [pollId, questionId, refresh])
  useEffect(() => {
    if (job?.status !== 'pending' && job?.status !== 'processing') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => pollsApi.knowledgeJob(pollId, questionId, controller.signal).then(setJob).catch(cause => { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(message(cause)) }), 3000)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [job, pollId, questionId])
  useEffect(() => {
    if (job?.status !== 'completed') return
    const controller = new AbortController()
    let active = true
    async function load() {
      try {
        const items: KnowledgeSuggestion[] = []
        for (let page = 1; ; page++) {
          const result = await pollsApi.knowledgeResults(pollId, questionId, page, controller.signal)
          if (result.jobId !== job?.id) throw new Error('Сервер вернул предложения другого задания ИИ.')
          items.push(...result.items)
          if (page >= result.totalPages) break
        }
        if (active) { onSuggestions(items); setError('') }
      } catch (cause) { if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(message(cause)) }
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [job?.id, job?.status, pollId, questionId, onSuggestions])
  useEffect(() => {
    if (cooldownUntil <= now) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil, now])
  async function start() {
    setConfirm(false); setBusy(true); setError('')
    try { setJob(await pollsApi.startKnowledgeJob(pollId, questionId)) }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 429 && cause.retryAfterSeconds !== undefined) { setCooldownUntil(Date.now() + cause.retryAfterSeconds * 1000); setNow(Date.now()) }
      if (cause instanceof ApiError && cause.problem?.code === 'knowledge_grading_manual_retry_limit') setRetryLimit(true)
      setError(message(cause))
    } finally { setBusy(false) }
  }
  const seconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  return <section className="teacher-knowledge-panel"><div><span className="eyebrow">ИИ-ПРОВЕРКА ЗНАНИЙ</span><h3>{questionText}</h3><p>На этой странице ожидают проверки: {pending}. Запуск охватит все ожидающие ответы этого задания.</p></div>
    {loading ? <p role="status">Проверяем состояние ИИ…</p> : <><p role="status">{job?.status === 'pending' ? 'Ожидает запуска' : job?.status === 'processing' ? 'Обрабатывается' : job?.status === 'completed' ? `Предложений получено: ${job.suggestedCount}` : job?.status === 'failed' ? 'Проверка завершилась ошибкой.' : 'Проверка ещё не запускалась.'}</p>{error && <p role="alert">{error}</p>}{seconds > 0 && <p>Повтор доступен через {seconds} с.</p>}{retryLimit && <p>Лимит ручных повторов исчерпан.</p>}{(!job || job.status === 'failed') && <button type="button" className="button button--check" disabled={busy || seconds > 0 || retryLimit} onClick={() => setConfirm(true)}>{busy ? 'Запускаем…' : job ? 'Повторить ИИ-проверку' : 'Запустить ИИ-проверку'}</button>}{error && <button type="button" className="teacher-grading__history" onClick={() => setRefresh(value => value + 1)}>Обновить статус</button>}</>}
    {confirm && <div className="builder-modal-backdrop"><section className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`knowledge-consent-${questionId}`}><h2 id={`knowledge-consent-${questionId}`}>Передать ответы GroqCloud?</h2><p>Эталон, критерии и обезличиваемые тексты всех ожидающих ответов этого задания будут переданы внешнему ИИ-провайдеру GroqCloud. Очистка email и телефонов не гарантирует полной анонимности: текст может содержать имена и уникальные сведения. Предложения ИИ не применяются автоматически.</p><div><button autoFocus type="button" className="button button--check" onClick={() => setConfirm(false)}>Отмена</button><button type="button" className="button button--primary" onClick={() => void start()}>Подтверждаю передачу</button></div></section></div>}
  </section>
}
