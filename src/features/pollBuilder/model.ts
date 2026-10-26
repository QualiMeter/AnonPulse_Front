import type { Poll, PollDraft, PollKind, QuestionType, ResponseMode, TestScale, TextPurpose } from '../../types/polls'
import { getPollKind, getQuestionType, getResponseMode } from '../../types/polls'

export type BuilderOption = { clientId: string; text: string }
export type BuilderQuestion = {
  clientId: string
  text: string
  type: QuestionType
  textPurpose: TextPurpose
  options: BuilderOption[]
  correctOptionClientIds: string[]
  weight: string
  knowledgeSettings: { expectedAnswer: string; gradingCriteria: string; maxScore: string }
}
export type BuilderForm = { title: string; kind: PollKind; responseMode: ResponseMode; testScale: TestScale | null; questions: BuilderQuestion[] }
export type ValidationErrors = Record<string, string>

const clientId = () => crypto.randomUUID()
const emptyKnowledge = () => ({ expectedAnswer: '', gradingCriteria: '', maxScore: '' })
export function newOption(text = ''): BuilderOption { return { clientId: clientId(), text } }
export function newQuestion(type: QuestionType = 'single_choice', kind: PollKind = 'survey'): BuilderQuestion {
  return { clientId: clientId(), text: '', type, textPurpose: kind === 'test' ? 'knowledge' : 'feedback', options: type === 'text' ? [] : [newOption(), newOption()], correctOptionClientIds: [], weight: '', knowledgeSettings: emptyKnowledge() }
}

export function switchFormKind(form: BuilderForm, kind: PollKind): BuilderForm {
  return {
    ...form, kind, responseMode: kind === 'test' ? 'identified' : form.responseMode,
    testScale: kind === 'test' ? form.testScale : null,
    questions: form.questions.map(question => question.type === 'text' ? { ...question, textPurpose: kind === 'test' ? 'knowledge' : 'feedback' } : question),
  }
}

export function createForm(poll?: Poll): BuilderForm {
  if (!poll) return { title: '', kind: 'survey', responseMode: 'anonymous', testScale: null, questions: [newQuestion()] }
  return {
    title: poll.title ?? '', kind: getPollKind(poll), responseMode: getResponseMode(poll), testScale: poll.testScale ?? null,
    questions: [...poll.questions].sort((a, b) => a.position - b.position).map(question => {
      const type = getQuestionType(question)
      const options = [...question.options].sort((a, b) => a.position - b.position).map(option => ({ clientId: option.id, text: option.text }))
      const availableIds = new Set(options.map(option => option.clientId))
      return {
        clientId: question.id, text: question.text, type,
        textPurpose: question.textPurpose ?? (getPollKind(poll) === 'test' ? 'knowledge' : 'feedback'),
        options, correctOptionClientIds: (question.correctOptionIds ?? []).filter(id => availableIds.has(id)),
        weight: question.weight == null ? '' : String(question.weight),
        knowledgeSettings: question.knowledgeSettings ? { expectedAnswer: question.knowledgeSettings.expectedAnswer, gradingCriteria: question.knowledgeSettings.gradingCriteria, maxScore: String(question.knowledgeSettings.maxScore) } : emptyKnowledge(),
      }
    }),
  }
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
export const moveQuestion = moveItem

export function validateForm(form: BuilderForm): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!form.questions.length) errors.questions = 'Добавьте хотя бы один вопрос.'
  if (form.kind === 'test') {
    if (form.responseMode !== 'identified') errors.responseMode = 'Для теста требуется именной режим.'
    if (![5, 10, 12, 100].includes(form.testScale ?? 0)) errors.testScale = 'Выберите шкалу оценки.'
  }
  for (const question of form.questions) {
    const prefix = `question:${question.clientId}:`
    if (!question.text.trim()) errors[`${prefix}text`] = 'Введите текст вопроса.'
    if (question.type === 'text') {
      if (question.options.length) errors[`${prefix}options`] = 'У текстового вопроса не должно быть вариантов.'
      if (form.kind === 'test' && question.textPurpose !== 'knowledge') errors[`${prefix}textPurpose`] = 'В тесте текстовый вопрос должен проверять знания.'
      if (question.textPurpose === 'knowledge') {
        if (!question.knowledgeSettings.expectedAnswer.trim()) errors[`${prefix}expectedAnswer`] = 'Введите эталонный ответ.'
        if (!question.knowledgeSettings.gradingCriteria.trim()) errors[`${prefix}gradingCriteria`] = 'Введите критерии оценивания.'
        const score = Number(question.knowledgeSettings.maxScore)
        if (!Number.isInteger(score) || score < 1 || score > 100) errors[`${prefix}maxScore`] = 'Укажите целое число от 1 до 100.'
      }
      continue
    }
    if (question.options.length < 2) errors[`${prefix}options`] = 'Добавьте минимум два варианта.'
    const normalized = question.options.map(option => option.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru'))
    question.options.forEach((option, index) => {
      const key = `option:${option.clientId}`
      if (!normalized[index]) errors[key] = 'Введите вариант ответа.'
      else if (normalized.indexOf(normalized[index]) !== index) errors[key] = 'Этот вариант уже есть в вопросе.'
    })
    if (form.kind === 'test') {
      const weight = Number(question.weight.replace(',', '.'))
      if (!/^(?:\d+)(?:[.,]\d{1,2})?$/.test(question.weight.trim()) || !Number.isFinite(weight) || weight <= 0 || weight > 10000) errors[`${prefix}weight`] = 'Вес: от 0,01 до 10000, не более двух знаков после запятой.'
      const validIds = new Set(question.options.map(option => option.clientId))
      const selected = question.correctOptionClientIds
      if (selected.length !== new Set(selected).size || selected.some(id => !validIds.has(id)) || selected.length === 0 || (question.type === 'single_choice' && selected.length !== 1)) {
        errors[`${prefix}correctOptionIndexes`] = question.type === 'single_choice' ? 'Выберите ровно один правильный вариант.' : 'Выберите хотя бы один правильный вариант.'
      }
    }
  }
  return errors
}

export function toPollDraft(form: BuilderForm): PollDraft {
  return {
    title: form.title.trim() || null, kind: form.kind,
    responseMode: form.kind === 'test' ? 'identified' : form.responseMode,
    testScale: form.kind === 'test' ? form.testScale : null,
    questions: form.questions.map(question => {
      const text = question.text.trim()
      if (question.type === 'text') return {
        text, type: 'text' as const, textPurpose: question.textPurpose, options: [] as [],
        ...(question.textPurpose === 'knowledge' ? { knowledgeSettings: { expectedAnswer: question.knowledgeSettings.expectedAnswer.trim(), gradingCriteria: question.knowledgeSettings.gradingCriteria.trim(), maxScore: Number(question.knowledgeSettings.maxScore) } } : {}),
      }
      return {
        text, type: question.type, options: question.options.map(option => option.text.trim()),
        ...(form.kind === 'test' ? { weight: Number(question.weight.replace(',', '.')), correctOptionIndexes: question.correctOptionClientIds.map(id => question.options.findIndex(option => option.clientId === id)).sort((a, b) => a - b) } : {}),
      }
    }),
  }
}

export function mapServerValidation(form: BuilderForm, errors?: Record<string, string[]>): ValidationErrors {
  const mapped: ValidationErrors = {}
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const message = messages.join(' ')
    const question = /^Questions\[(\d+)\](?:\.(.*))?$/i.exec(key)
    if (!question) {
      const field = key.toLowerCase()
      mapped[field === 'title' ? 'title' : field === 'kind' ? 'kind' : field === 'responsemode' ? 'responseMode' : field === 'testscale' ? 'testScale' : 'questions'] = message
      continue
    }
    const item = form.questions[Number(question[1])]
    if (!item) { mapped.questions = message; continue }
    const field = question[2] ?? ''
    const option = /^Options\[(\d+)\]/i.exec(field)
    if (option) {
      const selected = item.options[Number(option[1])]
      mapped[selected ? `option:${selected.clientId}` : `question:${item.clientId}:options`] = message
    } else {
      const match = /^(?:KnowledgeSettings\.)?(Text|Type|TextPurpose|Weight|CorrectOptionIndexes(?:\[\d+\])?|ExpectedAnswer|GradingCriteria|MaxScore)$/i.exec(field)
      const mappedField = match?.[1] === 'Text' ? 'text' : match?.[1] ? match[1][0].toLowerCase() + match[1].slice(1) : 'options'
      mapped[`question:${item.clientId}:${mappedField.startsWith('correctOptionIndexes') ? 'correctOptionIndexes' : mappedField}`] = message
    }
  }
  return mapped
}
