import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { pollsApi } from '../../api/polls'
import { getQuestionType, type GradeHistory, type KnowledgeSuggestion, type Poll, type TestAttempt, type TestAttemptAnswer } from '../../types/polls'

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось сохранить изменение. Попробуйте снова.'
  if (error.status === 400) return 'Проверьте балл: допустимо от 0 до максимума, не более двух знаков после запятой.'
  if (error.status === 401) return 'Сессия завершилась. Войдите снова.'
  if (error.status === 403) return 'Нет доступа к оцениванию этой работы.'
  if (error.status === 404) return 'Работа или ответ не найдены. Обновите список.'
  if (error.status === 409) return error.problem?.code === 'attempt_has_pending_answers' ? 'Сначала проверьте все ответы.' : 'Результат уже утверждён или состояние работы изменилось. Обновите список.'
  if (error.status === null) return error.message
  return 'Не удалось сохранить изменение. Попробуйте снова.'
}

function GradeField({ pollId, attemptId, answer, disabled, onSaved }: { pollId: string; attemptId: string; answer: TestAttemptAnswer; disabled: boolean; onSaved: () => void }) {
  const [value, setValue] = useState(answer.score === null ? '' : String(answer.score))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => setValue(answer.score === null ? '' : String(answer.score)), [answer.score])
  const normalized = value.trim().replace(',', '.')
  const valid = /^(?:\d+)(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) <= answer.maximumScore
  async function save() {
    if (!valid || busy || disabled) return
    setBusy(true); setMessage('')
    try { await pollsApi.gradeAnswer(pollId, attemptId, answer.answerId, Number(normalized)); setMessage('Балл сохранён.'); onSaved() }
    catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="teacher-grade-field"><label>Балл из {answer.maximumScore}<input type="text" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} disabled={disabled || busy} aria-invalid={value !== '' && !valid} /></label><button type="button" onClick={() => void save()} disabled={disabled || busy || !valid || (answer.score !== null && Number(normalized) === answer.score)}>{busy ? 'Сохраняем…' : 'Сохранить балл'}</button>{value !== '' && !valid && <span role="alert">Введите число от 0 до {answer.maximumScore}, до двух знаков после запятой.</span>}{message && <span role="status">{message}</span>}</div>
}

export function AttemptGrading({ poll, attempt, suggestions, onUpdated }: { poll: Poll; attempt: TestAttempt; suggestions: Record<string, KnowledgeSuggestion>; onUpdated: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<GradeHistory | null>(null)
  const [historyError, setHistoryError] = useState('')
  const pending = attempt.answers.filter(answer => answer.gradingState === 'pending' || answer.score === null).length
  useEffect(() => {
    if (!confirm) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirm(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirm])
  useEffect(() => {
    if (!showHistory) return
    const controller = new AbortController()
    setHistory(null); setHistoryError('')
    pollsApi.gradeHistory(poll.id, attempt.id, controller.signal).then(setHistory).catch(error => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setHistoryError(errorMessage(error))
    })
    return () => controller.abort()
  }, [showHistory, poll.id, attempt.id, attempt.rawScore])
  async function finalize() {
    setConfirm(false); setBusy(true); setMessage('')
    try { await pollsApi.finalizeAttempt(poll.id, attempt.id); setMessage('Результат утверждён.'); onUpdated() }
    catch (error) { setMessage(errorMessage(error)); onUpdated() }
    finally { setBusy(false) }
  }
  async function accept(answerId: string, suggestionId: string) {
    setBusy(true); setMessage('')
    try { await pollsApi.acceptKnowledgeSuggestion(poll.id, attempt.id, answerId, suggestionId); setMessage('Предложение ИИ принято. Баллы обновляются.'); onUpdated() }
    catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <div className="teacher-grading">
    <ol className="teacher-answer-list">{[...poll.questions].sort((a, b) => a.position - b.position).map((question, index) => {
      const answer = attempt.answers.find(item => item.questionId === question.id)
      const suggestion = answer && suggestions[answer.answerId]
      const selected = question.options.filter(option => answer?.selectedOptionIds.includes(option.id)).sort((a, b) => a.position - b.position)
      return <li key={question.id}><span className="teacher-answer-list__number">{String(index + 1).padStart(2, '0')}</span><div><span className="teacher-answer-list__label">Вопрос</span><strong>{question.text}</strong>{getQuestionType(question) === 'text' ? <><div className="teacher-answer-list__response"><span className="teacher-answer-list__label">Ответ студента</span><p>{answer?.text || 'Ответ не найден'}</p></div>{question.knowledgeSettings && <details className="teacher-answer-key"><summary>Эталон и критерии</summary><div><strong>Эталонный ответ</strong><p>{question.knowledgeSettings.expectedAnswer}</p><strong>Критерии оценивания</strong><p>{question.knowledgeSettings.gradingCriteria}</p></div></details>}{suggestion && <div className="teacher-ai-suggestion"><strong>Предложение ИИ: {suggestion.suggestedScore} / {suggestion.maxScore}</strong><p>{suggestion.explanation}</p>{suggestion.correctPoints.length > 0 && <p>Верно: {suggestion.correctPoints.join('; ')}</p>}{suggestion.missingOrIncorrectPoints.length > 0 && <p>Недостаёт или неверно: {suggestion.missingOrIncorrectPoints.join('; ')}</p>}{suggestion.needsReview && <p className="teacher-ai-suggestion__warning">Нужна проверка преподавателя. {suggestion.reviewReasons.join('; ')}</p>}{answer && !attempt.isFinal && <button type="button" disabled={busy} onClick={() => void accept(answer.answerId, suggestion.suggestionId)}>Принять оценку ИИ</button>}</div>}</> : <div className="teacher-choice-key"><span className="teacher-answer-list__label">Варианты ответа</span>{[...question.options].sort((a, b) => a.position - b.position).map(option => { const chosen = selected.some(item => item.id === option.id); const correct = question.correctOptionIds?.includes(option.id) ?? false; return <div key={option.id} className={`teacher-choice-key__option ${chosen && !correct ? 'teacher-choice-key__option--wrong' : ''} ${correct ? 'teacher-choice-key__option--correct' : ''}`}><span>{option.text}</span><span>{chosen ? 'Выбран студентом' : ''}{chosen && correct ? ' · ' : ''}{correct ? 'Правильный' : ''}</span></div> })}</div>}{answer && <><span className="teacher-answer-list__score">{answer.score === null ? 'Ожидает проверки' : `Начислено: ${answer.score} / ${answer.maximumScore}`}</span>{!attempt.isFinal && <GradeField key={answer.answerId} pollId={poll.id} attemptId={attempt.id} answer={answer} disabled={busy} onSaved={onUpdated} />}</>}</div></li>
    })}</ol>
    <div className="teacher-grading__actions"><button type="button" className="button button--dark" disabled={attempt.isFinal || pending > 0 || busy} onClick={() => setConfirm(true)}>{attempt.isFinal ? 'Результат утверждён' : 'Утвердить результат'}</button>{!attempt.isFinal && pending > 0 && <p>{pending} ответов ожидают проверки. Утверждение пока недоступно.</p>}{message && <p role="status">{message}</p>}<button type="button" className="teacher-grading__history" onClick={() => setShowHistory(value => !value)} aria-expanded={showHistory}>{showHistory ? 'Скрыть историю' : 'История оценивания'}</button></div>
    {showHistory && <div className="teacher-grading__history-list">{historyError ? <p role="alert">{historyError}</p> : !history ? <p role="status">Загружаем историю…</p> : history.changes.length ? <ol>{history.changes.map(change => <li key={change.id}><time dateTime={change.changedAt}>{new Date(change.changedAt).toLocaleString('ru-RU')}</time><span>{change.oldScore === null ? 'Без оценки' : change.oldScore} → {change.newScore}</span><span>{change.source === 'manual' ? 'Вручную' : 'Предложение ИИ'}</span></li>)}</ol> : <p>Изменений пока нет.</p>}</div>}
    {confirm && <div className="builder-modal-backdrop"><section className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`finalize-${attempt.id}`}><h2 id={`finalize-${attempt.id}`}>Утвердить результат?</h2><p>После утверждения изменить баллы будет нельзя. Оценка станет окончательной.</p><div><button autoFocus type="button" className="button button--check" onClick={() => setConfirm(false)}>Отмена</button><button type="button" className="button button--primary" onClick={() => void finalize()}>Утвердить результат</button></div></section></div>}
  </div>
}
