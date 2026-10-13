import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import type { Poll } from '../../data/demoPolls'
import { createForm, moveQuestion, newOption, newQuestion, validateForm, type BuilderForm, type BuilderQuestion } from './model'
import './builder.css'

type Props = {
  mode: 'create' | 'edit'
  poll?: Poll
  navigate: (to: string) => void
  onDirtyChange: (dirty: boolean) => void
  onDemoSave: (form: BuilderForm) => void
}

function questionLabel(question: BuilderQuestion, index: number) {
  return question.text.trim() || `Вопрос ${index + 1}`
}

function Preview({ form, onClose }: { form: BuilderForm; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
        if (!focusable?.length) return
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return <div className="builder-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="builder-preview" role="dialog" aria-modal="true" aria-labelledby="builder-preview-title">
      <div className="builder-preview__top"><div><span className="builder-preview__tag"><Icon name="eye" size={15} />ПРЕДПРОСМОТР</span><h2 id="builder-preview-title">Так опрос увидит студент</h2></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Закрыть предпросмотр"><Icon name="close" size={19} /></button></div>
      <div className="builder-preview__body"><div className="builder-preview__intro"><p className="eyebrow">АНОНИМНЫЙ ОПРОС</p><h3>{form.title.trim() || form.questions[0]?.text.trim() || 'Опрос без названия'}</h3><p>Выберите один ответ в каждом вопросе. Это только предпросмотр: ответы не отправляются.</p></div>
        {form.questions.length === 0 ? <div className="builder-preview__empty">Добавьте вопрос, чтобы увидеть форму опроса.</div> : form.questions.map((question, index) => <fieldset className="builder-preview__question" key={question.clientId}><legend><span>{String(index + 1).padStart(2, '0')}</span>{question.text.trim() || 'Текст вопроса пока не заполнен'}</legend><div className="builder-preview__options">{question.options.map((option, optionIndex) => <label key={option.clientId} className={`builder-preview__option ${answers[question.clientId] === option.clientId ? 'builder-preview__option--selected' : ''}`}><input type="radio" name={`preview-${question.clientId}`} checked={answers[question.clientId] === option.clientId} onChange={() => setAnswers(current => ({ ...current, [question.clientId]: option.clientId }))} /><span>{option.text.trim() || `Вариант ${optionIndex + 1}`}</span></label>)}</div></fieldset>)}
      </div><div className="builder-preview__bottom"><span>Только визуальный просмотр · без сохранения</span><button className="button button--dark" type="button" onClick={onClose}>Вернуться к редактированию</button></div>
    </section>
  </div>
}

export default function BuilderPage({ mode, poll, navigate, onDirtyChange, onDemoSave }: Props) {
  const [form, setForm] = useState<BuilderForm>(() => createForm(poll))
  const initialSnapshot = useRef(JSON.stringify(form))
  const [showErrors, setShowErrors] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [activeQuestion, setActiveQuestion] = useState<string | null>(form.questions[0]?.clientId ?? null)
  const validation = useMemo(() => validateForm(form), [form])
  const errors = showErrors ? validation : {}
  const dirty = JSON.stringify(form) !== initialSnapshot.current
  const errorCount = Object.keys(validation).length

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  function updateQuestion(id: string, update: (question: BuilderQuestion) => BuilderQuestion) {
    setForm(current => ({ ...current, questions: current.questions.map(question => question.clientId === id ? update(question) : question) }))
  }

  function addQuestion() {
    const question = newQuestion()
    setForm(current => ({ ...current, questions: [...current.questions, question] }))
    setActiveQuestion(question.clientId)
    requestAnimationFrame(() => {
      document.getElementById(`builder-question-${question.clientId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document.getElementById(`builder-text-${question.clientId}`)?.focus({ preventScroll: true })
    })
  }

  function removeQuestion(id: string) {
    setForm(current => ({ ...current, questions: current.questions.filter(question => question.clientId !== id) }))
    setCollapsed(current => { const next = new Set(current); next.delete(id); return next })
    if (activeQuestion === id) setActiveQuestion(null)
  }

  function addOption(questionId: string) {
    const option = newOption()
    updateQuestion(questionId, question => ({ ...question, options: [...question.options, option] }))
    setCollapsed(current => { const next = new Set(current); next.delete(questionId); return next })
    requestAnimationFrame(() => document.getElementById(`builder-option-${option.clientId}`)?.focus())
  }

  function scrollToQuestion(id: string) {
    setCollapsed(current => { const next = new Set(current); next.delete(id); return next })
    setActiveQuestion(id)
    requestAnimationFrame(() => document.getElementById(`builder-question-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function checkForm() {
    setShowErrors(true)
    if (errorCount > 0) {
      const firstInvalid = form.questions.find(question => validation[`question:${question.clientId}:text`] || validation[`question:${question.clientId}:options`] || question.options.some(option => validation[`option:${option.clientId}`]))
      if (firstInvalid) setCollapsed(current => { const next = new Set(current); next.delete(firstInvalid.clientId); return next })
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = firstInvalid
          ? document.querySelector<HTMLElement>(`#builder-question-${firstInvalid.clientId} [aria-invalid="true"]`)
          : document.getElementById('builder-add-first')
        target?.focus()
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }))
    }
    return errorCount === 0
  }

  function saveDemo() {
    if (!checkForm()) return
    onDirtyChange(false)
    onDemoSave(form)
  }

  return <div className="page builder-page">
    <nav className="breadcrumbs" aria-label="Путь к странице"><button className="breadcrumb-button" type="button" onClick={() => navigate('/app/polls')}>Опросы</button><Icon name="chevronRight" size={15} />{mode === 'edit' && poll && <><button className="breadcrumb-button breadcrumb-button--truncate" type="button" onClick={() => navigate(`/app/polls/${poll.id}`)}>{poll.title || poll.questions[0]?.text || 'Опрос без названия'}</button><Icon name="chevronRight" size={15} /></>}<span aria-current="page">{mode === 'create' ? 'Новый опрос' : 'Редактирование'}</span></nav>
    <div className="builder-heading"><div><p className="eyebrow">{mode === 'create' ? 'НОВЫЙ ОПРОС' : 'РЕДАКТИРОВАНИЕ ЧЕРНОВИКА'}</p><h1>{mode === 'create' ? 'Создать опрос' : 'Изменить черновик'}</h1><p>{mode === 'create' ? 'Соберите вопросы и варианты ответа. Студент сможет выбрать один вариант в каждом вопросе.' : 'Название, вопросы и варианты заменяются целиком. Сейчас изменения сохраняются только в деморежиме.'}</p></div><button className="button button--preview" type="button" onClick={() => setPreviewOpen(true)}><Icon name="eye" size={17} />Предпросмотр</button></div>

    <div className="builder-grid">
      <div className="builder-main">
        <section className="builder-intro" aria-labelledby="builder-title-heading"><div className="builder-card-heading"><span className="builder-card-heading__icon"><Icon name="edit" size={18} /></span><div><h2 id="builder-title-heading">Основная информация</h2><p>Название помогает найти опрос в кабинете</p></div></div><label className="builder-label" htmlFor="builder-title">Название опроса <span>необязательно</span></label><input className="builder-input builder-input--title" id="builder-title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Например, обратная связь по лекции" /><p className="builder-help">Если оставить поле пустым, в списке будет показан первый вопрос.</p></section>

        <div className="builder-section-heading"><div><p className="eyebrow">СОДЕРЖАНИЕ</p><h2>Вопросы <span>{form.questions.length}</span></h2></div><button type="button" className="builder-add-inline" onClick={addQuestion}><Icon name="plus" size={17} />Добавить вопрос</button></div>
        {errors.questions && <p className="builder-error builder-error--global" role="alert"><Icon name="alert" size={16} />{errors.questions}</p>}
        {form.questions.length === 0 && <div className="builder-empty"><span className="builder-empty__icon"><Icon name="layers" size={24} /></span><h3>Пока нет вопросов</h3><p>Добавьте первый вопрос и минимум два варианта ответа.</p><button id="builder-add-first" type="button" className="button button--dark" onClick={addQuestion}><Icon name="plus" size={17} />Добавить вопрос</button></div>}
        <div className="builder-questions">{form.questions.map((question, index) => {
          const isCollapsed = collapsed.has(question.clientId)
          const textError = errors[`question:${question.clientId}:text`]
          const optionsError = errors[`question:${question.clientId}:options`]
          return <section className={`builder-question ${activeQuestion === question.clientId ? 'builder-question--active' : ''}`} id={`builder-question-${question.clientId}`} key={question.clientId} aria-labelledby={`builder-question-heading-${question.clientId}`} onFocus={() => setActiveQuestion(question.clientId)}>
            <div className="builder-question__top"><span className="builder-question__number">{String(index + 1).padStart(2, '0')}</span><div className="builder-question__heading"><h3 id={`builder-question-heading-${question.clientId}`}>{questionLabel(question, index)}</h3><p>Один вариант ответа</p></div><div className="builder-question__controls"><button type="button" className="icon-button" onClick={() => setForm(current => ({ ...current, questions: moveQuestion(current.questions, index, index - 1) }))} disabled={index === 0} aria-label={`Поднять вопрос ${index + 1} выше`} title="Поднять выше"><Icon name="up" size={18} /></button><button type="button" className="icon-button" onClick={() => setForm(current => ({ ...current, questions: moveQuestion(current.questions, index, index + 1) }))} disabled={index === form.questions.length - 1} aria-label={`Опустить вопрос ${index + 1} ниже`} title="Опустить ниже"><Icon name="down" size={18} /></button><button type="button" className="icon-button icon-button--danger" onClick={() => removeQuestion(question.clientId)} aria-label={`Удалить вопрос ${index + 1}`} title="Удалить вопрос"><Icon name="trash" size={17} /></button><span className="builder-control-divider" /><button type="button" className="icon-button" onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(question.clientId)) next.delete(question.clientId); else next.add(question.clientId); return next })} aria-expanded={!isCollapsed} aria-controls={`builder-question-body-${question.clientId}`} aria-label={`${isCollapsed ? 'Развернуть' : 'Свернуть'} вопрос ${index + 1}`}><Icon name={isCollapsed ? 'down' : 'up'} size={19} /></button></div></div>
            {!isCollapsed && <div className="builder-question__body" id={`builder-question-body-${question.clientId}`}><label className="builder-label" htmlFor={`builder-text-${question.clientId}`}>Текст вопроса <span className="builder-label__required">*</span></label><input className={`builder-input ${textError ? 'builder-input--error' : ''}`} id={`builder-text-${question.clientId}`} value={question.text} onChange={event => updateQuestion(question.clientId, current => ({ ...current, text: event.target.value }))} placeholder="О чём вы хотите спросить?" aria-invalid={Boolean(textError)} aria-describedby={textError ? `builder-text-error-${question.clientId}` : undefined} />{textError && <p className="builder-error" id={`builder-text-error-${question.clientId}`} role="alert">{textError}</p>}
              <div className="builder-options-heading"><span className="builder-label">Варианты ответа</span><span>Минимум 2 · один выбор</span></div>{optionsError && <p className="builder-error" role="alert">{optionsError}</p>}
              <div className="builder-options">{question.options.map((option, optionIndex) => { const optionError = errors[`option:${option.clientId}`]; return <div className="builder-option-row" key={option.clientId}><span className="builder-option-row__radio" aria-hidden="true" /><div className="builder-option-row__field"><input className={`builder-input ${optionError ? 'builder-input--error' : ''}`} id={`builder-option-${option.clientId}`} value={option.text} onChange={event => updateQuestion(question.clientId, current => ({ ...current, options: current.options.map(item => item.clientId === option.clientId ? { ...item, text: event.target.value } : item) }))} placeholder={`Вариант ${optionIndex + 1}`} aria-label={`Вариант ${optionIndex + 1} вопроса ${index + 1}`} aria-invalid={Boolean(optionError)} aria-describedby={optionError ? `builder-option-error-${option.clientId}` : undefined} />{optionError && <p className="builder-error" id={`builder-option-error-${option.clientId}`} role="alert">{optionError}</p>}</div><button className="icon-button icon-button--danger" type="button" onClick={() => updateQuestion(question.clientId, current => ({ ...current, options: current.options.filter(item => item.clientId !== option.clientId) }))} disabled={question.options.length <= 2} title={question.options.length <= 2 ? 'Нужно минимум два варианта' : 'Удалить вариант'} aria-label={`Удалить вариант ${optionIndex + 1} вопроса ${index + 1}`}><Icon name="close" size={17} /></button></div> })}</div><button className="builder-add-option" type="button" onClick={() => addOption(question.clientId)}><Icon name="plus" size={17} />Добавить вариант</button>
            </div>}
          </section>
        })}</div>
        {form.questions.length > 0 && <button className="builder-add-question" type="button" onClick={addQuestion}><Icon name="plus" size={20} /><span>Добавить ещё вопрос</span></button>}
      </div>

      <aside className="builder-aside" aria-label="Структура опроса"><div className="builder-outline"><div className="builder-outline__header"><div><p className="eyebrow">НАВИГАЦИЯ</p><h2>Структура опроса</h2></div><span>{form.questions.length}</span></div><div className="builder-outline__items">{form.questions.length === 0 ? <p className="builder-outline__empty">Вопросы появятся здесь</p> : form.questions.map((question, index) => <button key={question.clientId} type="button" className={`builder-outline__item ${activeQuestion === question.clientId ? 'builder-outline__item--active' : ''}`} onClick={() => scrollToQuestion(question.clientId)}><span>{String(index + 1).padStart(2, '0')}</span><span>{questionLabel(question, index)}</span></button>)}</div><div className="builder-outline__footer"><Icon name="info" size={17} /><p>Порядок вопросов можно менять стрелками на карточках.</p></div></div><div className="builder-aside__note"><Icon name="lock" size={18} /><p>Редактирование доступно только для черновиков. Демо-сохранение действует до обновления вкладки.</p></div></aside>
    </div>

    <div className="builder-footer"><div className="builder-footer__state"><span className={`builder-footer__dot ${dirty ? 'builder-footer__dot--dirty' : ''}`} /><div><strong>{dirty ? 'Есть несохранённые изменения' : mode === 'edit' ? 'Черновик открыт для редактирования' : 'Новый опрос'}</strong><span>Демо-изменения сохраняются только в текущей вкладке</span></div></div><div className="builder-footer__actions"><button type="button" className="button button--check" onClick={checkForm}><Icon name="check" size={17} />Проверить форму</button><button type="button" className="button button--primary" onClick={saveDemo}><Icon name="check" size={16} />Сохранить в демо</button></div></div>
    {showErrors && <div className={`builder-validation ${errorCount ? 'builder-validation--error' : 'builder-validation--success'}`} role="status"><Icon name={errorCount ? 'alert' : 'check'} size={18} /><span>{errorCount ? `Найдены ошибки: ${errorCount}. Исправьте отмеченные поля.` : 'Форма заполнена корректно. Можно сохранить её в деморежиме.'}</span></div>}
    {previewOpen && <Preview form={form} onClose={() => setPreviewOpen(false)} />}
  </div>
}
