import { useEffect, useRef, useState, type FormEvent } from 'react'
import { pollsApi } from '../../api/polls'
import { ApiError } from '../../api/client'
import { Icon, type IconName } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import { getPollKind, getQuestionType, getResponseMode, type PublicPoll } from '../../types/polls'
import { PublicFrame } from './PublicFrame'
import './publicVoting.css'

type LoadState = 'loading' | 'ready' | 'unsupported' | 'closed' | 'unavailable' | 'missing' | 'error'
type VoteStage = 'form' | 'sending' | 'success' | 'send-error'

function StatePanel({ icon, eyebrow, title, children, action }: { icon: IconName; eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="vote-state" aria-labelledby="vote-state-title"><span className="vote-state__icon"><Icon name={icon} size={25} /></span><p className="vote-eyebrow">{eyebrow}</p><h1 id="vote-state-title">{title}</h1><div className="vote-state__body">{children}</div>{action && <div className="vote-state__action">{action}</div>}</section>
}

function LoadingState() {
  return <div className="vote-loading" role="status" aria-label="Загрузка опроса"><div className="vote-loading__line vote-loading__line--short" /><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__card"><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__option" /><div className="vote-loading__option" /></div><p>Загружаем опрос…</p></div>
}

export default function PublicVotingPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [poll, setPoll] = useState<PublicPoll | null>(null)
  const [load, setLoad] = useState<LoadState>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attempted, setAttempted] = useState(false)
  const [stage, setStage] = useState<VoteStage>('form')
  const [sendError, setSendError] = useState('')
  const sendingRef = useRef(false)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const questions = poll ? [...poll.questions].sort((a, b) => a.position - b.position) : []
  const answeredCount = questions.filter(question => Boolean(answers[question.id])).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  useEffect(() => {
    const controller = new AbortController()
    setLoad('loading')
    pollsApi.publicPoll(id, controller.signal).then(value => {
      setPoll(value)
      setLoad(getPollKind(value) === 'test' || getResponseMode(value) !== 'anonymous' || value.questions.some(question => getQuestionType(question) !== 'single_choice') ? 'unsupported' : 'ready')
    }).catch(async error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 409) {
        try {
          const result = await pollsApi.results(id, controller.signal)
          if (!controller.signal.aborted) setLoad(result.status === 'closed' && result.resultsType === 'final' ? 'closed' : 'unavailable')
        } catch (resultError) {
          if (!controller.signal.aborted) setLoad(resultError instanceof ApiError && [401, 403, 404, 409].includes(resultError.status ?? 0) ? 'unavailable' : 'error')
        }
      } else setLoad(error instanceof ApiError && error.status === 404 ? 'missing' : 'error')
    })
    return () => controller.abort()
  }, [id, loadAttempt])
  useEffect(() => { if (stage === 'success') { window.scrollTo({ top: 0, behavior: 'instant' }); resultHeading.current?.focus() } }, [stage])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current || !poll) return
    setAttempted(true)
    if (!allAnswered) {
      const missing = questions.find(question => !answers[question.id])
      requestAnimationFrame(() => document.getElementById(`vote-option-${missing?.id}-0`)?.focus())
      return
    }
    sendingRef.current = true
    setStage('sending')
    setSendError('')
    try {
      await pollsApi.vote(id, questions.map(question => ({ questionId: question.id, optionId: answers[question.id] })))
      setStage('success')
    } catch (error) {
      setStage('send-error')
      setSendError(error instanceof ApiError ? error.status === 400 ? 'Ответы не приняты. Проверьте выбранные варианты и откройте опрос заново, если ошибка повторится.' : error.status === 404 ? 'Опрос больше не найден.' : error.status === 409 ? 'Ответы не приняты. Возможно, этот браузер уже участвовал или опрос перестал принимать ответы. Точную причину здесь определить нельзя.' : error.status === 429 ? 'Слишком много попыток. Подождите и попробуйте позже.' : error.status === null ? error.message : 'Сервер не принял ответы. Попробуйте позже.' : 'Не удалось отправить ответы.')
    } finally { sendingRef.current = false }
  }

  if (load === 'loading') return <PublicFrame id={id} compact><LoadingState /></PublicFrame>
  if (load !== 'ready' || !poll) {
    const closed = load === 'closed'
    if (load === 'unsupported') return <PublicFrame id={id} compact><StatePanel icon="info" eyebrow="НОВЫЙ ФОРМАТ" title="Прохождение появится позже"><p>Эта форма использует новый режим участия или тип вопроса. Поддержка публичного прохождения появится в следующем обновлении AnonPulse. Ответы здесь пока не отправляются.</p></StatePanel></PublicFrame>
    return <PublicFrame id={id} compact><StatePanel icon={closed ? 'lock' : load === 'missing' ? 'search' : 'alert'} eyebrow={closed ? 'ГОЛОСОВАНИЕ ЗАВЕРШЕНО' : load === 'missing' ? 'ССЫЛКА НЕ НАЙДЕНА' : 'ОПРОС НЕДОСТУПЕН'} title={closed ? 'Опрос закрыт' : load === 'missing' ? 'Опрос не найден' : load === 'error' ? 'Не удалось открыть опрос' : 'Голосование сейчас недоступно'} action={closed ? <AppLink to={`/p/${id}/results`} navigate={navigate} className="vote-button vote-button--primary">Посмотреть итоги <Icon name="arrowRight" size={18} /></AppLink> : load === 'error' ? <button type="button" className="vote-button vote-button--primary" onClick={() => setLoadAttempt(value => value + 1)}>Повторить</button> : undefined}><p>{closed ? 'Приём ответов завершён. Теперь доступны итоговые результаты.' : load === 'missing' ? 'Проверьте адрес ссылки или попросите преподавателя отправить её снова.' : load === 'error' ? 'Проверьте соединение и попробуйте ещё раз.' : 'Опрос может быть ещё не опубликован или уже недоступен. Проверить его состояние по этой ссылке пока нельзя.'}</p></StatePanel></PublicFrame>
  }
  if (questions.length === 0) return <PublicFrame id={id} compact><StatePanel icon="layers" eyebrow="НЕТ ВОПРОСОВ" title="Опрос пуст"><p>Сообщите преподавателю, что в опросе нет вопросов.</p></StatePanel></PublicFrame>

  const title = poll.title?.trim() || questions[0]?.text || 'Опрос без названия'
  if (stage === 'success') return <PublicFrame id={id} compact><section className="vote-success" aria-labelledby="vote-success-title"><span className="vote-success__symbol"><Icon name="check" size={34} /></span><p className="vote-eyebrow">ОТВЕТ ПРИНЯТ</p><h1 ref={resultHeading} tabIndex={-1} id="vote-success-title">Ваш голос учтён</h1><p>Спасибо за участие в опросе «{title}».</p><div className="vote-success__note"><Icon name="info" size={19} /><span>Повторное участие из этого браузера ограничено сервером. Итоговые результаты станут доступны после закрытия опроса.</span></div></section></PublicFrame>

  return <PublicFrame id={id}><div className="vote-intro"><div className="vote-intro__top"><p className="vote-eyebrow"><span className="vote-eyebrow__dot" />АНОНИМНЫЙ ОПРОС</p><span className="vote-intro__time"><Icon name="list" size={16} />{questions.length} {questions.length === 1 ? 'вопрос' : questions.length < 5 ? 'вопроса' : 'вопросов'}</span></div><h1>{title}</h1><p className="vote-intro__lead">Выберите по одному варианту в каждом вопросе. Ответы можно изменить до отправки.</p><div className="vote-progress"><div className="vote-progress__labels"><strong>{answeredCount} из {questions.length} заполнено</strong><span>{Math.round(answeredCount / questions.length * 100)}%</span></div><div className="vote-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-label="Заполнено вопросов"><span style={{ width: `${answeredCount / questions.length * 100}%` }} /></div></div></div>
    <section className="vote-privacy" aria-labelledby="vote-privacy-title"><span className="vote-privacy__icon"><Icon name="lock" size={19} /></span><div><h2 id="vote-privacy-title">Об анонимности</h2><p>Вход не нужен. Ответы не связываются с аккаунтом. Техническая cookie ограничивает повторное участие в этом браузере. Абсолютная анонимность не гарантируется: инфраструктура может обрабатывать технические данные.</p></div></section>
    <form onSubmit={event => void submit(event)} noValidate><div className="vote-section-heading"><div><p className="vote-eyebrow">ВАШИ ОТВЕТЫ</p><h2>Вопросы опроса</h2></div><span>Все вопросы обязательны</span></div>
      <div className="vote-questions">{questions.map((question, index) => { const selected = answers[question.id]; const missing = attempted && !selected; return <fieldset className={`vote-question ${missing ? 'vote-question--error' : ''}`} key={question.id} aria-describedby={missing ? `vote-error-${question.id}` : undefined}><legend><span className="vote-question__number">{String(index + 1).padStart(2, '0')}</span><span>{question.text}</span></legend><div className="vote-options">{[...question.options].sort((a, b) => a.position - b.position).map((option, optionIndex) => <label key={option.id} className={`vote-option ${selected === option.id ? 'vote-option--selected' : ''}`}><input id={`vote-option-${question.id}-${optionIndex}`} type="radio" name={`answer-${question.id}`} value={option.id} checked={selected === option.id} disabled={stage === 'sending'} onChange={() => setAnswers(current => ({ ...current, [question.id]: option.id }))} /><span className="vote-option__mark" aria-hidden="true" /><span className="vote-option__text">{option.text}</span><span className="vote-option__check" aria-hidden="true"><Icon name="check" size={16} /></span></label>)}</div>{missing && <p className="vote-question__error" id={`vote-error-${question.id}`} role="alert">Выберите один вариант, чтобы продолжить.</p>}</fieldset> })}</div>
      {stage === 'send-error' && <div className="vote-submit-error" role="alert"><Icon name="alert" size={19} /><div><strong>Не удалось отправить ответы</strong><p>{sendError}</p></div></div>}
      <div className="vote-submit"><div className="vote-submit__status"><strong>{allAnswered ? 'Можно отправлять' : `Осталось ответить: ${questions.length - answeredCount}`}</strong><span>{allAnswered ? 'Проверьте ответы перед отправкой' : 'Выбор можно изменить в любой момент'}</span></div><button className="vote-button vote-button--primary" type="submit" disabled={stage === 'sending'}>{stage === 'sending' ? <><span className="vote-spinner" aria-hidden="true" />Отправляем…</> : <>Отправить ответы <Icon name="arrowRight" size={19} /></>}</button></div><span className="sr-only" role="status">{stage === 'sending' ? 'Идёт отправка ответов' : ''}</span>
    </form></PublicFrame>
}
