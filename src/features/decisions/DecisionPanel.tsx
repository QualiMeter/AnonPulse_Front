import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Icon } from '../../components/Icon'
import './decision.css'

export default function DecisionPanel({ text, onPublish }: { text?: string; onPublish: (text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [notice, setNotice] = useState('')
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const length = draft.trim().length
  const error = length === 0 ? 'Напишите решение перед публикацией.' : length > 5000 ? 'Сократите текст до 5000 символов.' : ''

  function openEditor() {
    setDraft(text ?? '')
    setAttempted(false)
    setNotice('')
    setServerError('')
    setEditing(true)
  }

  useEffect(() => {
    if (!editing) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    textareaRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setEditing(false)
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('textarea, button:not([disabled])')
      if (!focusable?.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [editing, saving])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setAttempted(true)
    if (error) { textareaRef.current?.focus(); return }
    setSaving(true)
    setServerError('')
    try {
      await onPublish(draft.trim())
      setEditing(false)
      setNotice(text ? 'Решение обновлено на сервере.' : 'Решение опубликовано на сервере.')
    } catch (cause) {
      setServerError(cause instanceof ApiError ? cause.status === 409 ? 'Опрос должен быть закрыт перед публикацией решения.' : cause.status === 400 ? 'Проверьте текст решения.' : cause.status === null ? cause.message : 'Не удалось сохранить решение.' : 'Не удалось сохранить решение.')
    } finally { setSaving(false) }
  }

  return <section className="aside-card decision-card decision-card--results decision-editor" aria-labelledby="decision-editor-title">
    <p className="eyebrow">ПОСЛЕ ОПРОСА</p><h2 id="decision-editor-title">Решение преподавателя</h2>
    {text ? <p className="decision-editor__text">{text}</p> : <p className="decision-card__empty">Решение пока не опубликовано. Расскажите студентам, что изменится по итогам обратной связи.</p>}
    <button type="button" className="decision-editor__button" onClick={openEditor}><Icon name={text ? 'edit' : 'plus'} size={16} />{text ? 'Изменить решение' : 'Написать решение'}</button>
    {notice && <div className="decision-editor__notice" role="status"><Icon name="check" size={17} />{notice}</div>}
    {editing && <div className="decision-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setEditing(false) }}><section ref={dialogRef} className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title" aria-describedby="decision-modal-description">
      <div className="decision-modal__header"><div><p className="eyebrow">РЕШЕНИЕ ПО ИТОГАМ ОПРОСА</p><h2 id="decision-modal-title">{text ? 'Изменить решение' : 'Опубликовать решение'}</h2></div><button className="icon-button" type="button" onClick={() => setEditing(false)} disabled={saving} aria-label="Закрыть редактор"><Icon name="close" size={20} /></button></div>
      <p id="decision-modal-description" className="decision-modal__lead">Опишите конкретное действие по итогам ответов. После сохранения текст увидят все посетители страницы итогов.</p>
      <form onSubmit={event => void submit(event)} noValidate><label htmlFor="decision-text">Текст решения</label><textarea ref={textareaRef} id="decision-text" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Например, добавим больше времени на разбор практических задач…" aria-invalid={Boolean(attempted && error)} aria-describedby={`decision-count${attempted && error ? ' decision-error' : ''}`} disabled={saving} /><div className="decision-modal__meta"><span id="decision-count">От 1 до 5000 символов</span><span className={length > 5000 ? 'decision-modal__over' : ''}>{length} / 5000</span></div>
        {attempted && error && <p className="decision-modal__error" id="decision-error" role="alert">{error}</p>}{serverError && <p className="decision-modal__error" role="alert">{serverError}</p>}
        <div className="decision-modal__footer"><button type="button" className="decision-modal__cancel" onClick={() => setEditing(false)} disabled={saving}>Отмена</button><button type="submit" className="button button--primary" disabled={saving}>{saving ? 'Сохраняем…' : text ? 'Обновить решение' : 'Опубликовать'}<Icon name="arrowRight" size={17} /></button></div>
      </form>
    </section></div>}
  </section>
}
