import type { PublicAnswer } from '../../api/polls'
import { getQuestionType, type PublicPoll } from '../../types/polls'

export type ResponseValues = { selected: Record<string, string[]>; texts: Record<string, string>; name: string; group: string }
export type ResponseErrors = { name?: string; group?: string; questions: Record<string, string> }

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ')

export function validateResponses(poll: PublicPoll, values: ResponseValues): ResponseErrors {
  const errors: ResponseErrors = { questions: {} }
  const name = normalize(values.name)
  if (poll.kind === 'test' || poll.responseMode === 'identified') {
    if (name.length < 1 || name.length > 150) errors.name = 'Укажите имя от 1 до 150 символов.'
  }
  if (poll.kind === 'test') {
    const group = normalize(values.group)
    if (group.length < 1 || group.length > 100) errors.group = 'Укажите группу от 1 до 100 символов.'
  }
  for (const question of poll.questions) {
    if (getQuestionType(question) === 'text') {
      const length = values.texts[question.id]?.trim().length ?? 0
      if (length < 1 || length > 4000) errors.questions[question.id] = 'Введите ответ от 1 до 4000 символов.'
    } else {
      const options = values.selected[question.id] ?? []
      const validIds = new Set(question.options.map(option => option.id))
      if (!options.length || options.some(id => !validIds.has(id)) || new Set(options).size !== options.length || (getQuestionType(question) === 'single_choice' && options.length !== 1)) errors.questions[question.id] = getQuestionType(question) === 'multiple_choice' ? 'Выберите хотя бы один вариант.' : 'Выберите один вариант.'
    }
  }
  return errors
}

export function answeredCount(poll: PublicPoll, values: ResponseValues): number {
  return poll.questions.filter(question => getQuestionType(question) === 'text' ? Boolean(values.texts[question.id]?.trim()) : Boolean(values.selected[question.id]?.length)).length
}

export function buildAnswers(poll: PublicPoll, values: ResponseValues): PublicAnswer[] {
  return [...poll.questions].sort((a, b) => a.position - b.position).flatMap<PublicAnswer>(question => {
    if (getQuestionType(question) === 'text') return [{ questionId: question.id, text: values.texts[question.id].trim() }]
    const selected = new Set(values.selected[question.id])
    return [...question.options].sort((a, b) => a.position - b.position).filter(option => selected.has(option.id)).map(option => ({ questionId: question.id, optionId: option.id }))
  })
}

export function normalizedIdentity(values: ResponseValues) {
  return { respondentName: normalize(values.name), respondentGroup: normalize(values.group) }
}
