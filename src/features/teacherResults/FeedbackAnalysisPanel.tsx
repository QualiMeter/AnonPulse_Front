import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { pollsApi } from '../../api/polls'
import { Icon } from '../../components/Icon'
import type { FeedbackAnalysis } from '../../types/polls'
import './feedbackAnalysis.css'

function analysisError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось получить анализ. Попробуйте снова.'
  switch (error.problem?.code) {
    case 'no_feedback_answers': return 'Для анализа пока нет непустых отзывов.'
    case 'poll_not_closed': return 'Анализ доступен после закрытия опроса.'
    case 'knowledge_analysis_not_supported': return 'Анализ ответов на проверку знаний пока недоступен.'
    case 'external_processing_consent_required': return 'Подтвердите передачу текстов внешнему провайдеру.'
    case 'feedback_limit_exceeded': return 'Объём отзывов превышает лимит обработки. Сервер не обрезал ответы.'
    case 'provider_token_limit_exceeded': return 'Объём отзывов превышает лимит ИИ-провайдера.'
    case 'ai_not_configured': return 'ИИ-анализ сейчас не настроен на сервере.'
    case 'analysis_retry_cooldown': return 'Повторный запуск временно ограничен.'
  }
  if (error.status === 401) return 'Сессия завершилась. Войдите снова.'
  if (error.status === 403) return 'У вас нет доступа к анализу этого опроса.'
  if (error.status === 404) return 'Анализ или вопрос не найден. Обновите страницу опроса.'
  if (error.status === 413) return 'Объём отзывов превышает лимит обработки.'
  if (error.status === 429) return 'Повторный запуск временно ограничен.'
  if (error.status === 503) return 'ИИ-анализ сейчас не настроен на сервере.'
  if (error.status === null) return error.message
  return 'Не удалось получить анализ. Попробуйте снова.'
}

function failureText(code: string | null) {
  switch (code) {
    case 'free_quota_exhausted': return 'Бесплатная квота ИИ-провайдера исчерпана. Повторите анализ позже.'
    case 'provider_token_limit_exceeded': return 'Объём отзывов превышает лимит ИИ-провайдера.'
    case 'no_feedback_answers': return 'Для анализа нет непустых отзывов.'
    default: return 'Анализ не завершился. Можно повторить запуск вручную.'
  }
}

export function FeedbackAnalysisPanel({ pollId, questionId, answerCount }: { pollId: string; questionId: string; answerCount: number }) {
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    pollsApi.feedbackAnalysis(pollId, questionId, controller.signal).then(value => { setAnalysis(value); setLoading(false) }).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof ApiError && error.status === 404 && error.problem?.code === 'analysis_not_found') {
        setAnalysis(null)
      } else {
        setAnalysis(null)
        setLoadError(analysisError(error))
      }
      setLoading(false)
    })
    return () => controller.abort()
  }, [pollId, questionId, refresh])

  useEffect(() => {
    if (analysis?.status !== 'pending' && analysis?.status !== 'processing') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      pollsApi.feedbackAnalysis(pollId, questionId, controller.signal).then(value => { setAnalysis(value); setLoadError('') }).catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError(analysisError(error))
      })
    }, 3000)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [analysis, pollId, questionId])

  useEffect(() => {
    if (cooldownUntil <= now) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil, now])

  useEffect(() => {
    if (!confirmOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmOpen(false)
      if (event.key !== 'Tab') return
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
      if (!buttons?.length) return
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [confirmOpen])

  async function start() {
    setConfirmOpen(false)
    setStarting(true)
    setStartError('')
    try {
      const value = await pollsApi.startFeedbackAnalysis(pollId, questionId)
      setAnalysis(value)
      setLoadError('')
    } catch (error) {
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds !== undefined) {
        setCooldownUntil(Date.now() + error.retryAfterSeconds * 1000)
        setNow(Date.now())
      }
      if (error instanceof ApiError && error.status === 403) setAnalysis(null)
      setStartError(analysisError(error))
    } finally { setStarting(false) }
  }

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const busy = starting || analysis?.status === 'pending' || analysis?.status === 'processing'
  const canStart = !loading && !loadError && !busy && secondsLeft === 0
  return <section className="feedback-analysis" aria-labelledby={`feedback-analysis-${questionId}`}>
    <div className="feedback-analysis__heading"><div><p className="eyebrow">ИИ-АНАЛИЗ ОТЗЫВОВ</p><h4 id={`feedback-analysis-${questionId}`}>Что говорят участники</h4></div><Icon name="layers" size={19} /></div>
    {loading ? <p className="feedback-analysis__state" role="status">Проверяем наличие анализа…</p> : loadError ? <div className="feedback-analysis__state" role="alert"><p>{loadError}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Повторить загрузку</button></div> : <>
      {!analysis && <p className="feedback-analysis__state">Текстовых ответов: {answerCount}. Анализ покажет сводку тем и рекомендации.</p>}
      {(analysis?.status === 'pending' || analysis?.status === 'processing') && <p className="feedback-analysis__state" role="status"><span className="feedback-analysis__pulse" />{analysis.status === 'pending' ? 'Анализ ожидает запуска. Статус обновляется автоматически.' : 'Анализ выполняется. Статус обновляется автоматически.'}</p>}
      {analysis?.status === 'failed' && <p className="feedback-analysis__state" role="alert">{failureText(analysis.errorCode)}</p>}
      {analysis?.status === 'completed' && analysis.report && <div className="feedback-report"><div className="feedback-report__summary"><span>КРАТКАЯ СВОДКА</span><p>{analysis.report.summary}</p></div><div className="feedback-report__columns"><section><h5>Основные темы</h5>{analysis.report.themes.length ? <ul>{analysis.report.themes.map((theme, index) => <li key={`${theme.name}-${index}`}><div><strong>{theme.name}</strong><span>{theme.mentionCount} упоминаний</span></div><p>{theme.description}</p></li>)}</ul> : <p>Темы не выделены.</p>}</section><section><h5>Рекомендации</h5>{analysis.report.recommendations.length ? <ul>{analysis.report.recommendations.map((recommendation, index) => <li key={`${recommendation.title}-${index}`}><strong>{recommendation.title}</strong><p>{recommendation.description}</p></li>)}</ul> : <p>Рекомендаций нет.</p>}</section></div><div className="feedback-report__limits"><strong>Ограничения анализа</strong>{analysis.report.limitations.length ? <ul>{analysis.report.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Ограничения не указаны.</p>}</div></div>}
      {analysis?.status === 'completed' && !analysis.report && <p className="feedback-analysis__state" role="alert">Сервер завершил анализ, но отчёт не получен. Обновите статус.</p>}
      {startError && <p className="feedback-analysis__error" role="alert">{startError}</p>}
      {secondsLeft > 0 && <p className="feedback-analysis__cooldown" role="status">Ручной повтор будет доступен через {secondsLeft} с.</p>}
      <div className="feedback-analysis__actions">{!analysis || analysis.status === 'failed' ? <button type="button" className="button button--check" onClick={() => setConfirmOpen(true)} disabled={!canStart}>{starting ? 'Запускаем…' : analysis?.status === 'failed' ? 'Повторить анализ' : 'Проанализировать отзывы'}</button> : analysis.status === 'completed' && !analysis.report ? <button type="button" className="button button--check" onClick={() => setRefresh(value => value + 1)}>Обновить статус</button> : null}</div>
    </>}
    {confirmOpen && <div className="builder-modal-backdrop"><section ref={dialogRef} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`feedback-confirm-${questionId}`} aria-describedby={`feedback-warning-${questionId}`}><span className="leave-dialog__icon"><Icon name="alert" size={22} /></span><h2 id={`feedback-confirm-${questionId}`}>Передать отзывы для ИИ-анализа?</h2><p id={`feedback-warning-${questionId}`}>Тексты отзывов после удаления очевидных email и телефонов будут переданы внешнему ИИ-провайдеру GroqCloud. Полная анонимность не гарантируется: сами тексты могут содержать имена или уникальные сведения.</p><div><button ref={cancelRef} type="button" className="button button--check" onClick={() => setConfirmOpen(false)}>Отмена</button><button type="button" className="button button--primary" onClick={() => void start()}>Подтверждаю передачу и запускаю</button></div></section></div>}
  </section>
}
