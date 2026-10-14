import { useRef, useState, type FormEvent } from 'react'
import { authApi, type CurrentUser } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Brand } from '../../components/Brand'
import './login.css'

type Props = { onSignedIn: (user: CurrentUser) => void }

export default function LoginPage({ onSignedIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!email.trim()) { setError('Укажите email.'); emailRef.current?.focus(); return }
    if (!password) { setError('Введите пароль.'); passwordRef.current?.focus(); return }
    setBusy(true)
    let loginAccepted = false
    try {
      const account = await authApi.login(email.trim(), password)
      loginAccepted = true
      if (!account.roles.includes('teacher')) throw new ApiError('У этой учётной записи нет доступа к кабинету преподавателя.', 403)
      // Verify that the browser retained the HttpOnly cookie before entering the workspace.
      const user = await authApi.me()
      onSignedIn(user)
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.status === 401 ? loginAccepted ? 'Вход принят, но браузер не сохранил сессию. Проверьте настройки cookie и прокси.' : 'Неверный email или пароль.'
          : cause.status === 429 ? 'Слишком много попыток. Подождите немного и попробуйте снова.'
          : cause.status === null ? cause.message
          : cause.status === 400 ? 'Проверьте email и пароль.'
          : cause.status === 403 ? 'У этой учётной записи нет доступа к кабинету преподавателя.'
          : cause.status >= 500 ? 'Сервер временно недоступен. Попробуйте позже.'
          : `Не удалось войти (${cause.status}). Попробуйте снова.`)
      } else setError(cause instanceof Error ? cause.message : 'Не удалось войти. Попробуйте снова.')
    } finally { setBusy(false) }
  }

  return <div className="auth-page">
    <header className="auth-header"><Brand /><span>Пространство преподавателя</span></header>
    <main className="auth-main">
      <div className="auth-intro"><p className="eyebrow">ANONPULSE / ПРЕПОДАВАТЕЛЯМ</p><h1>Обратная связь, за которой следуют действия.</h1><p>Ваше рабочее пространство для опросов, результатов и решений по итогам каждого курса.</p><div className="auth-steps" aria-hidden="true"><span>Мнение</span><i /><span>Результаты</span><i /><span>Действие</span></div></div>
      <section className="auth-card" aria-labelledby="auth-title"><p className="eyebrow">С ВОЗВРАЩЕНИЕМ</p><h2 id="auth-title">Войти в кабинет</h2><p className="auth-card__subtitle">Используйте учётную запись, выданную вашей организацией.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="login-email">Электронная почта</label><input ref={emailRef} id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" disabled={busy} aria-invalid={error === 'Укажите email.'} required />
          <label htmlFor="login-password">Пароль</label><div className="auth-password"><input ref={passwordRef} id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Введите пароль" disabled={busy} aria-invalid={error === 'Введите пароль.'} required /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={visible} disabled={busy}>{visible ? 'Скрыть' : 'Показать'}</button></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="button button--primary auth-submit" disabled={busy}>{busy ? 'Проверяем доступ…' : 'Войти в кабинет'}<span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-card__footnote">Самостоятельная регистрация преподавателей недоступна.</p>
      </section>
    </main>
    <footer className="auth-footer"><span>AnonPulse</span><span>Мнение → результаты → действие</span></footer>
  </div>
}
