import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import type { PollStatus } from '../../data/demoPolls'
import type { PublicPoll } from './demoPublicPolls'
import { PublicFrame } from './PublicFrame'
import './publicVoting.css'

type DemoScenario = 'form' | 'loading' | 'load-error' | 'repeat' | 'conflict' | 'submit-error' | 'empty' | 'rate-limit'
type VoteStage = 'form' | 'sending' | 'success' | 'send-error'
const allowedScenarios: DemoScenario[] = ['form', 'loading', 'load-error', 'repeat', 'conflict', 'submit-error', 'empty', 'rate-limit']

function initialScenario(): DemoScenario {
  const value = new URLSearchParams(window.location.search).get('demo')
  return allowedScenarios.includes(value as DemoScenario) ? value as DemoScenario : 'form'
}

function StatePanel({ icon, eyebrow, title, children, action }: { icon: IconName; eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="vote-state" aria-labelledby="vote-state-title"><span className="vote-state__icon"><Icon name={icon} size={25} /></span><p className="vote-eyebrow">{eyebrow}</p><h1 id="vote-state-title">{title}</h1><div className="vote-state__body">{children}</div>{action && <div className="vote-state__action">{action}</div>}</section>
}

function LoadingState() {
  return <div className="vote-loading" role="status" aria-label="Загрузка опроса"><div className="vote-loading__line vote-loading__line--short" /><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__card"><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__option" /><div className="vote-loading__option" /></div><p>Загружаем опрос…</p></div>
}

function FeedbackState({ id, kind, hasFinalResults, navigate, onRetry }: { id: string; kind: 'closed' | 'draft' | 'missing' | 'repeat' | 'conflict' | 'load-error' | 'empty' | 'rate-limit'; hasFinalResults?: boolean; navigate: (to: string) => void; onRetry?: () => void }) {
  const content = {
    closed: { icon: 'lock', eyebrow: 'ГОЛОСОВАНИЕ ЗАВЕРШЕНО', title: 'Опрос закрыт', body: 'Преподаватель завершил сбор ответов. Отправить голос больше нельзя.', aside: 'Теперь можно посмотреть итоговую статистику и решение преподавателя, если оно опубликовано.' },
    draft: { icon: 'lock', eyebrow: 'ОПРОС ПОКА НЕ ОПУБЛИКОВАН', title: 'Голосование ещё не началось', body: 'Этот опрос пока не принимает ответы. Проверьте ссылку позднее или обратитесь к тому, кто её отправил.', aside: '' },
    missing: { icon: 'search', eyebrow: 'ССЫЛКА НЕ НАЙДЕНА', title: 'Опрос не найден', body: 'Проверьте адрес ссылки. Если ошибка повторяется, попросите преподавателя отправить ссылку заново.', aside: '' },
    repeat: { icon: 'check', eyebrow: 'ДЕМОНСТРАЦИЯ ПОВТОРНОГО УЧАСТИЯ', title: 'Вы уже ответили', body: 'В рабочей версии повторное участие из этого браузера блокирует сервер. Ваши ответы не нужно отправлять ещё раз.', aside: 'Здесь показан отдельный демонстрационный сценарий, а не результат проверки cookie.' },
    conflict: { icon: 'alert', eyebrow: 'ДЕМОНСТРАЦИЯ КОНФЛИКТА', title: 'Не удалось принять ответы', body: 'Состояние опроса или участие в нём могло измениться. По этой ошибке нельзя понять, закрыт ли опрос или ответ уже был принят.', aside: 'Попросите преподавателя проверить, открыт ли опрос. Не отправляйте ответы повторно, пока причина не ясна.' },
    'load-error': { icon: 'alert', eyebrow: 'ОШИБКА ЗАГРУЗКИ', title: 'Не удалось открыть опрос', body: 'Проверьте соединение и попробуйте загрузить страницу снова.', aside: 'Это демонстрационное состояние; запрос к серверу не выполнялся.' },
    empty: { icon: 'layers', eyebrow: 'НЕТ ВОПРОСОВ', title: 'Опрос пока пуст', body: 'Здесь пока нет вопросов, на которые можно ответить. Попросите преподавателя проверить опрос.', aside: 'Это отдельное демонстрационное состояние.' },
    'rate-limit': { icon: 'alert', eyebrow: 'СЛИШКОМ МНОГО ЗАПРОСОВ', title: 'Попробуйте позже', body: 'Опрос временно недоступен из-за ограничения частоты запросов.', aside: 'Это демонстрационное состояние; сервер не вызывался.' },
  } as const
  const item = content[kind]
  const action = kind === 'closed' && hasFinalResults
    ? <AppLink to={`/p/${id}/results`} navigate={navigate} className="vote-button vote-button--primary">Посмотреть итоги <Icon name="arrowRight" size={18} /></AppLink>
    : onRetry && <button className="vote-button vote-button--primary" type="button" onClick={onRetry}>Показать опрос <Icon name="arrowRight" size={18} /></button>
  return <PublicFrame id={id} compact><StatePanel icon={item.icon} eyebrow={item.eyebrow} title={item.title} action={action}><p>{item.body}</p>{item.aside && <p className="vote-state__aside">{item.aside}</p>}</StatePanel></PublicFrame>
}

function sortQuestions(poll: PublicPoll) {
  return [...poll.questions].sort((a, b) => a.position - b.position)
}

export default function PublicVotingPage({ id, poll, status, hasFinalResults, navigate }: { id: string; poll?: PublicPoll; status?: PollStatus; hasFinalResults: boolean; navigate: (to: string) => void }) {
  const [scenario, setScenario] = useState<DemoScenario>(initialScenario)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attempted, setAttempted] = useState(false)
  const [stage, setStage] = useState<VoteStage>('form')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failedOnce = useRef(false)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const questions = poll ? sortQuestions(poll) : []
  const answeredCount = questions.filter(question => Boolean(answers[question.id])).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => { if (stage === 'success') { window.scrollTo({ top: 0, behavior: 'instant' }); resultHeading.current?.focus() } }, [stage])

  function retryLoad() {
    window.history.replaceState(null, '', window.location.pathname)
    setScenario('form')
  }

  function sendDemo() {
    if (stage === 'sending') return
    setStage('sending')
    timer.current = setTimeout(() => {
      if (scenario === 'submit-error' && !failedOnce.current) { failedOnce.current = true; setStage('send-error') }
      else setStage('success')
      timer.current = null
    }, 850)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (!allAnswered) {
      const firstMissing = questions.find(question => !answers[question.id])
      requestAnimationFrame(() => document.getElementById(`vote-option-${firstMissing?.id}-0`)?.focus())
      return
    }
    sendDemo()
  }

  if (status === 'closed') return <FeedbackState id={id} kind="closed" hasFinalResults={hasFinalResults} navigate={navigate} />
  if (status === 'draft') return <FeedbackState id={id} kind="draft" navigate={navigate} />
  if (!poll) return <FeedbackState id={id} kind="missing" navigate={navigate} />
  if (scenario === 'loading') return <PublicFrame id={id} compact><LoadingState /><button className="vote-button vote-button--secondary vote-loading__action" type="button" onClick={retryLoad}>Показать опрос в демо</button></PublicFrame>
  if (scenario === 'load-error' || scenario === 'repeat' || scenario === 'conflict' || scenario === 'empty' || scenario === 'rate-limit') return <FeedbackState id={id} kind={scenario} navigate={navigate} onRetry={scenario === 'load-error' ? retryLoad : undefined} />

  const title = poll.title?.trim() || questions[0]?.text || 'Опрос без названия'
  if (stage === 'success') return <PublicFrame id={id} compact><section className="vote-success" aria-labelledby="vote-success-title"><span className="vote-success__symbol"><Icon name="check" size={34} /></span><p className="vote-eyebrow">ДЕМОНСТРАЦИЯ УСПЕШНОЙ ОТПРАВКИ</p><h1 ref={resultHeading} tabIndex={-1} id="vote-success-title">Спасибо за ответ</h1><p>Вы прошли демо-опрос: {title}. Ответы никуда не отправлялись и не сохранялись.</p><div className="vote-success__note"><Icon name="info" size={19} /><span>В рабочей версии после успешного ответа повторное участие из того же браузера будет ограничено сервером. Итоговая статистика станет доступна после закрытия опроса.</span></div></section></PublicFrame>

  return <PublicFrame id={id}><div className="vote-intro"><div className="vote-intro__top"><p className="vote-eyebrow"><span className="vote-eyebrow__dot" />АНОНИМНЫЙ ОПРОС</p><span className="vote-intro__time"><Icon name="list" size={16} />{questions.length} {questions.length === 1 ? 'вопрос' : questions.length < 5 ? 'вопроса' : 'вопросов'}</span></div><h1>{title}</h1><p className="vote-intro__lead">Выберите по одному варианту в каждом вопросе. Ответы можно изменить до отправки.</p><div className="vote-progress"><div className="vote-progress__labels"><strong>{answeredCount} из {questions.length} заполнено</strong><span>{Math.round(answeredCount / questions.length * 100)}%</span></div><div className="vote-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-label="Заполнено вопросов"><span style={{ width: `${answeredCount / questions.length * 100}%` }} /></div></div></div>
    <section className="vote-privacy" aria-labelledby="vote-privacy-title"><span className="vote-privacy__icon"><Icon name="lock" size={19} /></span><div><h2 id="vote-privacy-title">Об анонимности</h2><p>Вход не нужен. В рабочей версии ответы не связываются с аккаунтом, а техническая cookie ограничивает повторное участие в этом браузере. Абсолютная анонимность не гарантируется: инфраструктура может обрабатывать технические данные.</p><p className="vote-privacy__demo">Сейчас это демо: ответы не передаются на сервер.</p></div></section>
    <form onSubmit={submit} noValidate><div className="vote-section-heading"><div><p className="vote-eyebrow">ВАШИ ОТВЕТЫ</p><h2>Вопросы опроса</h2></div><span>Все вопросы обязательны</span></div>
      <div className="vote-questions">{questions.map((question, index) => { const selected = answers[question.id]; const missing = attempted && !selected; return <fieldset className={`vote-question ${missing ? 'vote-question--error' : ''}`} key={question.id} aria-describedby={missing ? `vote-error-${question.id}` : undefined}><legend><span className="vote-question__number">{String(index + 1).padStart(2, '0')}</span><span>{question.text}</span></legend><div className="vote-options">{[...question.options].sort((a, b) => a.position - b.position).map((option, optionIndex) => <label key={option.id} className={`vote-option ${selected === option.id ? 'vote-option--selected' : ''}`}><input id={`vote-option-${question.id}-${optionIndex}`} type="radio" name={`answer-${question.id}`} value={option.id} checked={selected === option.id} disabled={stage === 'sending'} onChange={() => setAnswers(current => ({ ...current, [question.id]: option.id }))} /><span className="vote-option__mark" aria-hidden="true" /><span className="vote-option__text">{option.text}</span><span className="vote-option__check" aria-hidden="true"><Icon name="check" size={16} /></span></label>)}</div>{missing && <p className="vote-question__error" id={`vote-error-${question.id}`} role="alert">Выберите один вариант, чтобы продолжить.</p>}</fieldset> })}</div>
      {stage === 'send-error' && <div className="vote-submit-error" role="alert"><Icon name="alert" size={19} /><div><strong>Не удалось отправить ответы</strong><p>Это демонстрация ошибки. Ваш выбор сохранён на странице — попробуйте ещё раз.</p></div></div>}
      <div className="vote-submit"><div className="vote-submit__status"><strong>{allAnswered ? 'Можно отправлять' : `Осталось ответить: ${questions.length - answeredCount}`}</strong><span>{allAnswered ? 'Проверьте ответы перед отправкой' : 'Выбор можно изменить в любой момент'}</span></div><button className="vote-button vote-button--primary" type="submit" disabled={stage === 'sending'}>{stage === 'sending' ? <><span className="vote-spinner" aria-hidden="true" />Отправляем демо…</> : <>Отправить ответы <Icon name="arrowRight" size={19} /></>}</button></div><span className="sr-only" role="status">{stage === 'sending' ? 'Идёт демонстрационная отправка ответов' : ''}</span><p className="vote-form-footnote">Демонстрационная отправка · на сервер ничего не сохраняется</p>
    </form></PublicFrame>
}
