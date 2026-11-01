import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { pollsApi, type PersonalTestResult, type TestSubmissionReceipt } from '../../api/polls'
import { AppLink } from '../../components/AppLink'
import { Icon } from '../../components/Icon'
import { getTestReceipt } from './attemptStore'
import { PublicFrame } from './PublicFrame'
import './personalTestResult.css'

function resultError(error: unknown) {
  if (!(error instanceof ApiError)) return 'Не удалось получить результат. Проверьте соединение и попробуйте снова.'
  if (error.status === 400) return 'Проверьте формат идентификатора попытки и секрета.'
  if (error.status === 404) return 'Результат не найден. Проверьте идентификатор попытки и секрет.'
  if (error.status === 409) return 'Личный результат пока недоступен. Если тест ещё открыт, вернитесь после его закрытия.'
  if (error.status === 429) return `Слишком много запросов. Попробуйте позже${error.retryAfterSeconds ? `, через ${error.retryAfterSeconds} с` : ''}.`
  if (error.status === null) return error.message
  return 'Не удалось получить результат. Попробуйте позже.'
}

export default function PersonalTestResultPage({ id, navigate, unverified = false, embedded = false }: { id: string; navigate: (to: string) => void; unverified?: boolean; embedded?: boolean }) {
  const [attemptId, setAttemptId] = useState('')
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<PersonalTestResult | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'error'>('loading')
  const [error, setError] = useState('')
  const [stored, setStored] = useState(false)
  const [manual, setManual] = useState(unverified)

  useEffect(() => { if (result) document.title = 'Мой результат — AnonPulse' }, [result])

  async function load(receipt: TestSubmissionReceipt, signal?: AbortSignal) {
    setState('sending'); setError(''); setResult(null)
    try {
      const value = await pollsApi.personalTestResult(id, receipt.attemptId, receipt.accessSecret, signal)
      if (!signal?.aborted) {
        if (value.attemptId.toLowerCase() !== receipt.attemptId.toLowerCase()) throw new Error('Ответ сервера относится к другой попытке.')
        setResult(value); setState('ready')
      }
    } catch (cause) {
      if (signal?.aborted) return
      setError(resultError(cause)); setState('error')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    getTestReceipt(id).then(receipt => {
      if (controller.signal.aborted) return
      if (!receipt) { setState('ready'); return }
      setStored(true); setAttemptId(receipt.attemptId); setSecret(receipt.accessSecret)
      void load(receipt, controller.signal)
    }).catch(() => { if (!controller.signal.aborted) { setError('Не удалось прочитать сохранённую попытку. Введите данные вручную.'); setState('error') } })
    return () => controller.abort()
  }, [id])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!attemptId.trim() || !secret.trim()) { setError('Укажите идентификатор попытки и секрет.'); setState('error'); return }
    void load({ attemptId: attemptId.trim(), accessSecret: secret.trim() })
  }

  const final = result?.isFinal ? result : null
  return <PublicFrame id={id}>
    <div className="personal-result">
      <p className="vote-eyebrow">{unverified && !result ? 'ПРОВЕРКА ПОПЫТКИ' : 'ЛИЧНЫЙ РЕЗУЛЬТАТ · ТЕСТ'}</p>
      <h1>{unverified && !result ? 'Форма сейчас недоступна' : 'Мой результат'}</h1>
      {!final && <p className="personal-result__intro">{unverified && !result ? 'Форма может быть закрытым тестом или неопубликованным черновиком. Если вы проходили тест, проверьте свой результат с помощью сохранённых данных попытки или введите их вручную.' : 'Результат доступен только по идентификатору попытки и секрету, полученному после отправки теста.'}</p>}
      {state === 'loading' && <p role="status" className="personal-result__state">Ищем сохранённую попытку…</p>}
      {state === 'sending' && <p role="status" className="personal-result__state">Получаем результат с сервера…</p>}
      {state === 'error' && <p role="alert" className="personal-result__error">{error}</p>}
      {result && !result.isFinal && <section className="personal-result__state" role="status"><Icon name="info" size={22} /><div><h2>Результат ожидает проверки преподавателем</h2><p>Откройте эту страницу позже. До утверждения баллы не показываются.</p></div></section>}
      {final && <>
        <section className="personal-result__score" aria-labelledby="personal-result-title"><p className="vote-eyebrow">РЕЗУЛЬТАТ УТВЕРЖДЁН</p><h2 id="personal-result-title">{final.testTitle?.trim() || 'Тест без названия'}</h2><p>{final.respondentName} · {final.respondentGroup}</p><div><strong>{final.normalizedScore} <span>/ {final.testScale}</span></strong><span>Оценка по шкале {final.testScale} баллов</span></div></section>
        <section className="personal-result__answers"><h2>Ваши ответы</h2><ol>{final.answers.map((answer, index) => <li key={answer.answerId}><span className="personal-result__number">{String(index + 1).padStart(2, '0')}</span><div><h3>{answer.questionText}</h3><p className="personal-result__label">Ваш ответ</p>{answer.text ? <p className="personal-result__response">{answer.text}</p> : answer.selectedOptions.length ? <ul className="personal-result__choices">{answer.selectedOptions.map((option, optionIndex) => <li key={optionIndex}>{option.text}</li>)}</ul> : <p className="personal-result__response">Ответ не указан</p>}<p className="personal-result__points">Начислено: <strong>{answer.score} / {answer.maximumScore}</strong></p></div></li>)}</ol></section>
      </>}
      {(state !== 'loading' && state !== 'sending' && !final) && <div className="personal-result__access"><button type="button" className="vote-button vote-button--secondary" onClick={() => setManual(value => !value)} aria-expanded={manual}>{manual ? 'Скрыть ввод' : stored ? 'Другая попытка или устройство' : 'Ввести данные попытки'}</button>{manual && <form onSubmit={submit}><label htmlFor="personal-attempt-id">Идентификатор попытки</label><input id="personal-attempt-id" value={attemptId} onChange={event => setAttemptId(event.target.value)} autoComplete="off" required /><label htmlFor="personal-access-secret">Секрет доступа</label><input id="personal-access-secret" type="password" value={secret} onChange={event => setSecret(event.target.value)} autoComplete="off" required /><button type="submit" className="vote-button vote-button--primary">Показать результат</button></form>}{!manual && stored && <button type="button" className="personal-result__refresh" onClick={() => void load({ attemptId, accessSecret: secret })}>Обновить результат</button>}{!stored && !manual && <p>В этом браузере нет сохранённой попытки. Введите идентификатор и секрет, выданные после отправки теста.</p>}</div>}
      {!embedded && !final && <AppLink to={`/p/${id}`} navigate={navigate} className="personal-result__back"><Icon name="arrowLeft" size={16} />К странице теста</AppLink>}
    </div>
  </PublicFrame>
}
