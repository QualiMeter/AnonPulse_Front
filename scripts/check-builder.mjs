import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const bundle = buildSync({ entryPoints: ['src/features/pollBuilder/model.ts'], bundle: true, platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require)
const { createForm, moveItem, newOption, newQuestion, switchFormKind, toPollDraft, validateForm, mapServerValidation } = module.exports

const old = createForm({ id: 'p', title: null, status: 'draft', createdAt: '', publishedAt: null, closedAt: null, questions: [{ id: 'q', text: 'Вопрос', position: 0, options: [{ id: 'a', text: 'Да', position: 0 }, { id: 'b', text: 'Нет', position: 1 }] }] })
assert.equal(old.kind, 'survey')
assert.equal(old.responseMode, 'anonymous')
assert.equal(old.questions[0].type, 'single_choice')
assert.equal(validateForm(old).questions, undefined)
assert.equal(newQuestion('text', 'survey').textPurpose, 'feedback')
assert.equal(newQuestion('text', 'test').textPurpose, 'knowledge')
const surveyMulti = newQuestion('multiple_choice')
surveyMulti.text = 'Выберите темы'
surveyMulti.options[0].text = 'Тема A'
surveyMulti.options[1].text = 'Тема B'
const surveyText = newQuestion('text')
surveyText.text = 'Что изменить?'
const survey = { title: 'Обратная связь', kind: 'survey', responseMode: 'identified', testScale: null, questions: [surveyMulti, surveyText] }
assert.deepEqual(validateForm(survey), {})
assert.deepEqual(toPollDraft(survey), { title: 'Обратная связь', kind: 'survey', responseMode: 'identified', testScale: null, questions: [
  { text: 'Выберите темы', type: 'multiple_choice', options: ['Тема A', 'Тема B'] },
  { text: 'Что изменить?', type: 'text', textPurpose: 'feedback', options: [] },
] })
const switched = switchFormKind(survey, 'test')
assert.equal(switched.questions[1].textPurpose, 'knowledge')
switched.questions[1].knowledgeSettings = { expectedAnswer: 'Эталон', gradingCriteria: 'Критерии', maxScore: '5' }
const backToSurvey = switchFormKind(switched, 'survey')
assert.equal(backToSurvey.questions[1].textPurpose, 'feedback')
assert.equal(backToSurvey.questions[1].knowledgeSettings.expectedAnswer, 'Эталон')
assert.equal(toPollDraft(backToSurvey).questions[1].knowledgeSettings, undefined)

const legacySurvey = createForm({ id: 'legacy', title: null, kind: 'survey', responseMode: 'anonymous', status: 'draft', createdAt: '', publishedAt: null, closedAt: null, questions: [{ id: 'legacy-text', text: 'Знания', position: 0, type: 'text', textPurpose: 'knowledge', options: [], knowledgeSettings: { expectedAnswer: 'Ответ', gradingCriteria: 'Критерии', maxScore: 4 } }] })
assert.equal(legacySurvey.questions[0].textPurpose, 'knowledge')
assert.deepEqual(toPollDraft(legacySurvey).questions[0].knowledgeSettings, { expectedAnswer: 'Ответ', gradingCriteria: 'Критерии', maxScore: 4 })

const test = createForm({ id: 'test', title: 'Проверка', kind: 'test', responseMode: 'identified', testScale: 12, status: 'draft', createdAt: '', publishedAt: null, closedAt: null, questions: [
  { id: 'q1', text: 'Выберите', position: 0, type: 'multiple_choice', options: [{ id: 'a', text: 'A', position: 0 }, { id: 'b', text: 'B', position: 1 }, { id: 'c', text: 'C', position: 2 }], correctOptionIds: ['a', 'c'], weight: 2.5 },
  { id: 'q2', text: 'Объясните', position: 1, type: 'text', textPurpose: 'knowledge', options: [], knowledgeSettings: { expectedAnswer: 'Ответ', gradingCriteria: 'Критерии', maxScore: 10 } },
] })
assert.deepEqual(test.questions[0].correctOptionClientIds, ['a', 'c'])
assert.deepEqual(toPollDraft(test).questions[0].correctOptionIndexes, [0, 2])
test.questions[0].options = moveItem(test.questions[0].options, 0, 2)
assert.deepEqual(toPollDraft(test).questions[0].options, ['B', 'C', 'A'])
assert.deepEqual(toPollDraft(test).questions[0].correctOptionIndexes, [1, 2])
test.questions[0].options = test.questions[0].options.filter(option => option.clientId !== 'c')
test.questions[0].correctOptionClientIds = test.questions[0].correctOptionClientIds.filter(id => id !== 'c')
assert.deepEqual(toPollDraft(test).questions[0].correctOptionIndexes, [1])
assert.deepEqual(validateForm(test), {})

const blank = createForm()
assert.ok(validateForm(blank)[`question:${blank.questions[0].clientId}:text`])
const question = newQuestion('multiple_choice')
question.text = 'Вопрос'
question.options = [newOption('A'), newOption(' a ')]
blank.questions = [question]
assert.ok(validateForm(blank)[`option:${question.options[1].clientId}`])
blank.kind = 'test'; blank.responseMode = 'identified'; blank.testScale = 10
assert.ok(validateForm(blank)[`question:${question.clientId}:weight`])
assert.ok(validateForm(blank)[`question:${question.clientId}:correctOptionIndexes`])
const serverErrors = mapServerValidation(blank, { 'Questions[0].CorrectOptionIndexes[0]': ['Неверный индекс'], TestScale: ['Неверная шкала'] })
assert.equal(serverErrors[`question:${question.clientId}:correctOptionIndexes`], 'Неверный индекс')
assert.equal(serverErrors.testScale, 'Неверная шкала')

console.log('Builder model checks passed')
