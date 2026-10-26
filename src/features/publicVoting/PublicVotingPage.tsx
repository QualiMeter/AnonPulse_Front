import { useEffect, useRef, useState, type FormEvent } from 'react'
import { pollsApi, type PublicAnswer, type TestSubmissionReceipt } from '../../api/polls'
import { ApiError } from '../../api/client'
import { Icon, type IconName } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import { getPollKind, getQuestionType, getResponseMode, type PublicPoll } from '../../types/polls'
import { PublicFrame } from './PublicFrame'
import { storeTestReceipt } from './attemptStore'
import { clearPendingTest, hasPendingTest, markPendingTest } from './pendingTest'
import { answeredCount, buildAnswers, normalizedIdentity, validateResponses, type ResponseValues } from './model'
import './publicVoting.css'

type LoadState = 'loading' | 'ready' | 'closed' | 'unavailable' | 'missing' | 'error'
type Stage = 'form' | 'sending' | 'success' | 'error' | 'uncertain' | 'blocked'
type TestRequest = { respondentName: string; respondentGroup: string; clientRequestId: string; answers: PublicAnswer[] }
const emptyValues = (): ResponseValues => ({ selected: {}, texts: {}, name: '', group: '' })

function StatePanel({ icon, eyebrow, title, children, action }: { icon: IconName; eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="vote-state" aria-labelledby="vote-state-title"><span className="vote-state__icon"><Icon name={icon} size={25} /></span><p className="vote-eyebrow">{eyebrow}</p><h1 id="vote-state-title">{title}</h1><div className="vote-state__body">{children}</div>{action && <div className="vote-state__action">{action}</div>}</section>
}

function LoadingState() {
  return <div className="vote-loading" role="status" aria-label="Загрузка формы"><div className="vote-loading__line vote-loading__line--short" /><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__card"><div className="vote-loading__line vote-loading__line--title" /><div className="vote-loading__line" /><div className="vote-loading__option" /><div className="vote-loading__option" /></div><p>Загружаем форму…</p></div>
}

export default function PublicVotingPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [poll, setPoll] = useState<PublicPoll | null>(null)
  const [load, setLoad] = useState<LoadState>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [values, setValues] = useState<ResponseValues>(emptyValues)
  const [attempted, setAttempted] = useState(false)
  const [stage, setStage] = useState<Stage>(() => hasPendingTest(id) ? 'uncertain' : 'form')
  const [sendError, setSendError] = useState(() => hasPendingTest(id) ? 'Предыдущая отправка этого теста не получила подтверждения. После обновления страницы повторить тот же запрос невозможно. Новую попытку начните только если согласны с возможностью второй записи.' : '')
  const [receipt, setReceipt] = useState<TestSubmissionReceipt | null>(null)
  const [storageWarning, setStorageWarning] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [newAttemptPrompt, setNewAttemptPrompt] = useState(false)
  const [sameRetryAvailable, setSameRetryAvailable] = useState(() => !hasPendingTest(id))
  const sendingRef = useRef(false)
  const pendingTestRequest = useRef<TestRequest | null>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const questions = poll ? [...poll.questions].sort((a, b) => a.position - b.position) : []
  const isTest = poll ? getPollKind(poll) === 'test' : false
  const identified = poll ? isTest || getResponseMode(poll) === 'identified' : false
  const count = poll ? answeredCount(poll, values) : 0
  const validation = poll ? validateResponses(poll, values) : { questions: {} }
  const errorCount = Object.keys(validation.questions).length + Number(Boolean(validation.name)) + Number(Boolean(validation.group))
  const frozen = stage === 'sending' || stage === 'uncertain' || stage === 'blocked' || newAttemptPrompt

  useEffect(() => {
    const controller = new AbortController()
    setLoad('loading')
    pollsApi.publicPoll(id, controller.signal).then(value => { setPoll(value); setLoad('ready') }).catch(async error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 409) {
        // Public 409 alone cannot distinguish an unpublished form from a closed one.
        try {
          const result = await pollsApi.results(id, controller.signal)
          if (!controller.signal.aborted) setLoad(result.status === 'closed' && result.resultsType === 'final' ? 'closed' : 'unavailable')
        } catch (resultError) {
          if (!controller.signal.aborted) setLoad(resultError instanceof ApiError && [401, 403, 404, 409].includes(resultError.status ?? 0) ? 'unavailable' : 'error')
        }
      } else if (!controller.signal.aborted) setLoad(error instanceof ApiError && error.status === 404 ? 'missing' : 'error')
    })
    return () => controller.abort()
  }, [id, loadAttempt])
  useEffect(() => { if (stage === 'success') { window.scrollTo({ top: 0, behavior: 'instant' }); resultHeading.current?.focus() } }, [stage])
  useEffect(() => {
    if (!newAttemptPrompt) return
    const previous = document.activeElement as HTMLElement | null
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmRef.current?.querySelector('button')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNewAttemptPrompt(false)
      if (event.key !== 'Tab') return
      const buttons = confirmRef.current?.querySelectorAll<HTMLButtonElement>('button')
      if (!buttons?.length) return
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [newAttemptPrompt])

  function changeValues(update: (current: ResponseValues) => ResponseValues) {
    if (frozen) return
    setValues(update)
    if (stage === 'error') { pendingTestRequest.current = null; setStage('form'); setSendError('') }
  }
  function focusFirstError() {
    const firstQuestion = questions.find(question => validation.questions[question.id])
    const target = validation.name ? 'vote-name' : validation.group ? 'vote-group' : firstQuestion ? `vote-answer-${firstQuestion.id}` : ''
    if (target) requestAnimationFrame(() => document.getElementById(target)?.focus())
  }
  async function sendTest(request: TestRequest) {
    try {
      const saved = await pollsApi.submitTest(id, request)
      setReceipt(saved)
      try { await storeTestReceipt(id, saved) }
      catch { setStorageWarning('Не удалось сохранить секрет в хранилище этого браузера. Скопируйте его сейчас и сохраните в надёжном месте.') }
      clearPendingTest(id)
      pendingTestRequest.current = null
      setStage('success')
    } catch (error) {
      const api = error instanceof ApiError ? error : null
      const code = api?.problem?.code
      if (api?.status === null || api?.status === 409 || api?.status === 201 || (api?.status != null && api.status >= 500)) {
        setStage('uncertain')
        setSameRetryAvailable(api?.status !== 409)
        setSendError(code === 'submission_already_stored_secret_unavailable' ? 'Сервер уже сохранил эту попытку, но не может повторно выдать одноразовый секрет. Если первый ответ был потерян, получить этот секрет невозможно.' : code === 'idempotency_key_reused' ? 'Идентификатор этой попытки уже использован с другими ответами. Новую попытку можно начать только после подтверждения.' : 'Не удалось подтвердить результат отправки. Попытка могла сохраниться. Повтор того же запроса не создаст дубликат, но сервер не сможет повторно выдать утраченный секрет.')
      } else {
        clearPendingTest(id)
        pendingTestRequest.current = null
        setStage('error')
        setSendError(api?.status === 400 ? 'Сервер отклонил данные. Проверьте имя, группу и ответы.' : api?.status === 404 ? 'Тест не найден.' : api?.status === 429 ? 'Слишком много запросов. Подождите и попробуйте снова.' : 'Не удалось отправить тест. Попробуйте позже.')
      }
    } finally { sendingRef.current = false }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current || !poll || stage === 'uncertain' || stage === 'blocked') return
    setAttempted(true)
    if (errorCount) { focusFirstError(); return }
    sendingRef.current = true
    setStage('sending'); setSendError('')
    const answers = buildAnswers(poll, values)
    const identity = normalizedIdentity(values)
    if (isTest) {
      const request = pendingTestRequest.current ?? { ...identity, clientRequestId: crypto.randomUUID(), answers }
      pendingTestRequest.current = request
      markPendingTest(id, request.clientRequestId)
      await sendTest(request)
      return
    }
    try {
      await pollsApi.vote(id, answers, identified ? identity.respondentName : undefined)
      setStage('success')
    } catch (error) {
      const api = error instanceof ApiError ? error : null
      setStage(api?.status === 409 ? 'blocked' : 'error')
      setSendError(api?.status === 400 ? 'Ответы не приняты. Проверьте заполнение формы.' : api?.status === 404 ? 'Опрос больше не найден.' : api?.status === 409 ? 'Ответы не приняты. Возможно, этот браузер уже участвовал или опрос перестал принимать ответы. Точную причину здесь определить нельзя.' : api?.status === 429 ? 'Слишком много попыток. Подождите и попробуйте позже.' : api?.status === null ? api.message : 'Сервер не принял ответы. Попробуйте позже.')
    } finally { sendingRef.current = false }
  }
  async function retrySameTestRequest() {
    if (!pendingTestRequest.current || sendingRef.current) return
    sendingRef.current = true
    setStage('sending'); setSendError('')
    await sendTest(pendingTestRequest.current)
  }
  async function copySecret() {
    if (!receipt) return
    try { await navigator.clipboard.writeText(receipt.accessSecret); setCopyMessage('Секрет скопирован.') }
    catch { setCopyMessage('Не удалось скопировать автоматически. Выделите секрет в поле и скопируйте его вручную.') }
  }

  if (load === 'loading') return <PublicFrame id={id} compact><LoadingState /></PublicFrame>
  if (load !== 'ready' || !poll) {
    const closed = load === 'closed'
    return <PublicFrame id={id} compact><StatePanel icon={closed ? 'lock' : load === 'missing' ? 'search' : 'alert'} eyebrow={closed ? 'ГОЛОСОВАНИЕ ЗАВЕРШЕНО' : load === 'missing' ? 'ССЫЛКА НЕ НАЙДЕНА' : 'ФОРМА НЕДОСТУПНА'} title={closed ? 'Опрос закрыт' : load === 'missing' ? 'Форма не найдена' : load === 'error' ? 'Не удалось открыть форму' : 'Форма сейчас недоступна'} action={closed ? <AppLink to={`/p/${id}/results`} navigate={navigate} className="vote-button vote-button--primary">Посмотреть итоги <Icon name="arrowRight" size={18} /></AppLink> : load === 'error' ? <button type="button" className="vote-button vote-button--primary" onClick={() => setLoadAttempt(value => value + 1)}>Повторить</button> : undefined}><p>{closed ? 'Приём ответов завершён. Теперь доступны итоговые результаты.' : load === 'missing' ? 'Проверьте адрес ссылки или попросите преподавателя отправить её снова.' : load === 'error' ? 'Проверьте соединение и попробуйте ещё раз.' : 'Форма может быть ещё не опубликована или уже закрыта. По одному ответу сервера определить причину нельзя.'}</p></StatePanel></PublicFrame>
  }
  if (!questions.length) return <PublicFrame id={id} compact><StatePanel icon="layers" eyebrow="НЕТ ВОПРОСОВ" title="Форма пуста"><p>Сообщите преподавателю, что в форме нет вопросов.</p></StatePanel></PublicFrame>

  const title = poll.title?.trim() || questions[0]?.text || (isTest ? 'Тест без названия' : 'Опрос без названия')
  if (stage === 'success') return <PublicFrame id={id} compact><section className="vote-success" aria-labelledby="vote-success-title"><span className="vote-success__symbol"><Icon name="check" size={34} /></span><p className="vote-eyebrow">{isTest ? 'ПОПЫТКА СОХРАНЕНА' : 'ОТВЕТ ПРИНЯТ'}</p><h1 ref={resultHeading} tabIndex={-1} id="vote-success-title">{isTest ? 'Тест отправлен' : 'Ваш ответ учтён'}</h1><p>Спасибо за участие в {isTest ? 'тесте' : 'опросе'} «{title}».</p>{isTest && receipt ? <div className="vote-secret"><label htmlFor="vote-secret-value">Секрет доступа к личному результату</label><div className="vote-secret__row"><input id="vote-secret-value" readOnly value={receipt.accessSecret} onFocus={event => event.currentTarget.select()} /><button type="button" className="vote-button vote-button--secondary" onClick={() => void copySecret()}>Скопировать</button></div><p>Сохраните секрет в надёжном месте. Он понадобится для просмотра личного результата, когда эта функция появится. Сервер покажет его только сейчас.</p>{storageWarning && <p className="vote-secret__warning" role="alert">{storageWarning}</p>}{copyMessage && <p role="status">{copyMessage}</p>}</div> : <div className="vote-success__note"><Icon name="info" size={19} /><span>Повторное участие из этого браузера ограничено сервером. Итоговые результаты станут доступны после закрытия опроса.</span></div>}</section></PublicFrame>

  return <PublicFrame id={id}><div className="vote-intro"><div className="vote-intro__top"><p className="vote-eyebrow"><span className="vote-eyebrow__dot" />{isTest ? 'ТЕСТ · ПРОВЕРКА ЗНАНИЙ' : identified ? 'ИМЕННОЙ ОПРОС' : 'АНОНИМНЫЙ ОПРОС'}</p><span className="vote-intro__time"><Icon name="list" size={16} />{questions.length} {questions.length === 1 ? 'вопрос' : questions.length < 5 ? 'вопроса' : 'вопросов'}</span></div><h1>{title}</h1><p className="vote-intro__lead">Ответьте на все вопросы. Ответы можно изменить до отправки.</p><div className="vote-progress"><div className="vote-progress__labels"><strong>{count} из {questions.length} заполнено</strong><span>{Math.round(count / questions.length * 100)}%</span></div><div className="vote-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={count} aria-label="Заполнено вопросов"><span style={{ width: `${count / questions.length * 100}%` }} /></div></div></div>
    <section className="vote-privacy" aria-labelledby="vote-privacy-title"><span className="vote-privacy__icon"><Icon name={identified ? 'info' : 'lock'} size={19} /></span><div><h2 id="vote-privacy-title">{isTest ? 'Об участии в тесте' : identified ? 'Об именном участии' : 'Об анонимности'}</h2><p>{isTest ? 'Аккаунт не нужен. Имя и группу вы указываете самостоятельно; они не подтверждают личность. После отправки сохраните секрет доступа к будущему личному результату.' : identified ? 'Аккаунт не нужен. Вы сами указываете отображаемое имя; оно будет связано с ответами и доступно преподавателю после закрытия опроса. Техническая cookie ограничивает повторное участие в этом браузере.' : 'Вход не нужен. Ответы не связываются с аккаунтом. Техническая cookie ограничивает повторное участие в этом браузере. Абсолютная анонимность не гарантируется: инфраструктура может обрабатывать технические данные.'}</p></div></section>
    <form onSubmit={event => void submit(event)} noValidate>{identified && <section className="vote-identity" aria-labelledby="vote-identity-title"><h2 id="vote-identity-title">Об участнике</h2><div className="vote-identity__grid"><div><label htmlFor="vote-name">Ваше имя <span>*</span></label><input id="vote-name" className="vote-text-input" value={values.name} maxLength={150} disabled={frozen} onChange={event => changeValues(current => ({ ...current, name: event.target.value }))} placeholder="Как к вам обращаться" autoComplete="name" aria-invalid={Boolean(attempted && validation.name)} />{attempted && validation.name && <p className="vote-field-error" role="alert">{validation.name}</p>}</div>{isTest && <div><label htmlFor="vote-group">Группа <span>*</span></label><input id="vote-group" className="vote-text-input" value={values.group} maxLength={100} disabled={frozen} onChange={event => changeValues(current => ({ ...current, group: event.target.value }))} placeholder="Например, ИВТ-101" aria-invalid={Boolean(attempted && validation.group)} />{attempted && validation.group && <p className="vote-field-error" role="alert">{validation.group}</p>}</div>}</div><p>{isTest ? 'Имя и группа будут сохранены вместе с попыткой.' : 'Имя вводится вами и не проверяется сервером.'}</p></section>}
      <div className="vote-section-heading"><div><p className="vote-eyebrow">ВАШИ ОТВЕТЫ</p><h2>Вопросы {isTest ? 'теста' : 'опроса'}</h2></div><span>Все вопросы обязательны</span></div><div className="vote-questions">{questions.map((question, index) => { const type = getQuestionType(question); const selected = values.selected[question.id] ?? []; const error = attempted ? validation.questions[question.id] : undefined; return <fieldset className={`vote-question ${error ? 'vote-question--error' : ''}`} key={question.id} aria-describedby={error ? `vote-error-${question.id}` : undefined}><legend><span className="vote-question__number">{String(index + 1).padStart(2, '0')}</span><span>{question.text}</span></legend>{type === 'multiple_choice' && <p className="vote-question__hint">Можно выбрать несколько вариантов.</p>}{type === 'text' ? <div className="vote-text-wrap"><textarea id={`vote-answer-${question.id}`} className="vote-textarea" aria-label={`Ответ на вопрос ${index + 1}`} value={values.texts[question.id] ?? ''} maxLength={4000} disabled={frozen} onChange={event => changeValues(current => ({ ...current, texts: { ...current.texts, [question.id]: event.target.value } }))} placeholder="Напишите ваш ответ" aria-invalid={Boolean(error)} /><span>{(values.texts[question.id] ?? '').length} / 4000</span></div> : <div className="vote-options">{[...question.options].sort((a, b) => a.position - b.position).map((option, optionIndex) => <label key={option.id} className={`vote-option ${selected.includes(option.id) ? 'vote-option--selected' : ''}`}><input id={optionIndex === 0 ? `vote-answer-${question.id}` : undefined} type={type === 'multiple_choice' ? 'checkbox' : 'radio'} name={`answer-${question.id}`} value={option.id} checked={selected.includes(option.id)} disabled={frozen} onChange={() => changeValues(current => ({ ...current, selected: { ...current.selected, [question.id]: type === 'single_choice' ? [option.id] : selected.includes(option.id) ? selected.filter(item => item !== option.id) : [...selected, option.id] } }))} /><span className={`vote-option__mark ${type === 'multiple_choice' ? 'vote-option__mark--multiple' : ''}`} aria-hidden="true" /><span className="vote-option__text">{option.text}</span><span className="vote-option__check" aria-hidden="true"><Icon name="check" size={16} /></span></label>)}</div>}{error && <p className="vote-question__error" id={`vote-error-${question.id}`} role="alert">{error}</p>}</fieldset> })}</div>
      {(stage === 'error' || stage === 'blocked') && <div className="vote-submit-error" role="alert"><Icon name="alert" size={19} /><div><strong>Не удалось отправить ответы</strong><p>{sendError}</p>{stage === 'blocked' && <p>Повторную отправку на этой странице мы остановили. При необходимости откройте ссылку заново, чтобы проверить доступность формы.</p>}</div></div>}
      {stage === 'uncertain' && <div className="vote-submit-error" role="alert"><Icon name="alert" size={19} /><div><strong>Результат отправки неясен</strong><p>{sendError}</p><div className="vote-uncertain-actions">{sameRetryAvailable && <button className="vote-button vote-button--secondary" type="button" onClick={() => void retrySameTestRequest()}>Повторить тот же запрос</button>}<button className="vote-button vote-button--secondary" type="button" onClick={() => setNewAttemptPrompt(true)}>Начать новую попытку</button></div></div></div>}
      {newAttemptPrompt && <div className="vote-confirm" role="alertdialog" aria-modal="true" aria-labelledby="vote-confirm-title"><div ref={confirmRef}><h2 id="vote-confirm-title">Начать новую попытку?</h2><p>Предыдущая попытка могла сохраниться. Новая отправка может создать ещё одну запись, а секрет предыдущей попытки восстановить нельзя.</p><div><button type="button" className="vote-button vote-button--secondary" onClick={() => setNewAttemptPrompt(false)}>Оставить текущую</button><button type="button" className="vote-button vote-button--primary" onClick={() => { clearPendingTest(id); pendingTestRequest.current = null; setNewAttemptPrompt(false); setStage('form'); setSendError('') }}>Начать заново</button></div></div></div>}
      <div className="vote-submit"><div className="vote-submit__status"><strong>{stage === 'blocked' ? 'Отправка остановлена' : errorCount === 0 ? 'Можно отправлять' : `Осталось заполнить: ${questions.length - count + Number(Boolean(validation.name)) + Number(Boolean(validation.group))}`}</strong><span>Проверьте ответы перед отправкой</span></div><button className="vote-button vote-button--primary" type="submit" disabled={stage === 'sending' || stage === 'uncertain' || stage === 'blocked'}>{stage === 'sending' ? <><span className="vote-spinner" aria-hidden="true" />Отправляем…</> : <>Отправить {isTest ? 'тест' : 'ответы'} <Icon name="arrowRight" size={19} /></>}</button></div><span className="sr-only" role="status">{stage === 'sending' ? 'Идёт отправка ответов' : ''}</span>
    </form></PublicFrame>
}
