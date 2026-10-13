import type { Poll } from '../../data/demoPolls'

// clientId служит только ключом локальной формы и не является ID с сервера.
export type BuilderOption = { clientId: string; text: string }
export type BuilderQuestion = { clientId: string; text: string; options: BuilderOption[] }
export type BuilderForm = { title: string; questions: BuilderQuestion[] }
export type ValidationErrors = Record<string, string>

const clientId = () => crypto.randomUUID()

export function newOption(text = ''): BuilderOption { return { clientId: clientId(), text } }
export function newQuestion(): BuilderQuestion {
  return { clientId: clientId(), text: '', options: [newOption(), newOption()] }
}

export function createForm(poll?: Poll): BuilderForm {
  if (!poll) return { title: '', questions: [newQuestion()] }
  return {
    title: poll.title ?? '',
    questions: poll.questions.map(question => ({
      clientId: clientId(),
      text: question.text,
      options: question.options.map(option => newOption(option.text)),
    })),
  }
}

export function moveQuestion(questions: BuilderQuestion[], from: number, to: number): BuilderQuestion[] {
  if (to < 0 || to >= questions.length) return questions
  const next = [...questions]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function validateForm(form: BuilderForm): ValidationErrors {
  const errors: ValidationErrors = {}
  if (form.questions.length === 0) errors.questions = 'Добавьте хотя бы один вопрос.'

  for (const question of form.questions) {
    if (!question.text.trim()) errors[`question:${question.clientId}:text`] = 'Введите текст вопроса.'
    if (question.options.length < 2) errors[`question:${question.clientId}:options`] = 'Добавьте минимум два варианта.'

    const normalized = question.options.map(option => option.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru'))
    question.options.forEach((option, index) => {
      const key = `option:${option.clientId}`
      if (!normalized[index]) errors[key] = 'Введите вариант ответа.'
      else if (normalized.indexOf(normalized[index]) !== index) errors[key] = 'Этот вариант уже есть в вопросе.'
    })
  }
  return errors
}
