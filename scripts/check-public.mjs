import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
function load(entry) {
  const output = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', 'require', output)(module, module.exports, require)
  return module.exports
}
const { answeredCount, buildAnswers, validateResponses } = load('src/features/publicVoting/model.ts')
const { pollsApi } = load('src/api/polls.ts')
const { hasPendingTest, markPendingTest, clearPendingTest } = load('src/features/publicVoting/pendingTest.ts')
const storage = new Map()
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
assert.equal(hasPendingTest('poll'), false)
markPendingTest('poll', 'uuid')
assert.equal(hasPendingTest('poll'), true)
clearPendingTest('poll')
assert.equal(hasPendingTest('poll'), false)
const poll = { id: 'poll', title: 'Проверка', kind: 'survey', responseMode: 'identified', questions: [
  { id: 'one', text: 'Один', position: 0, type: 'single_choice', options: [{ id: 'a', text: 'A', position: 0 }, { id: 'b', text: 'B', position: 1 }] },
  { id: 'multi', text: 'Несколько', position: 1, type: 'multiple_choice', options: [{ id: 'c', text: 'C', position: 0 }, { id: 'd', text: 'D', position: 1 }] },
  { id: 'text', text: 'Текст', position: 2, type: 'text', options: [] },
] }
const values = { selected: { one: ['a'], multi: ['d', 'c'] }, texts: { text: '  Ответ  ' }, name: ' Иван ', group: '' }
assert.equal(answeredCount(poll, values), 3)
assert.deepEqual(validateResponses(poll, values), { questions: {} })
assert.deepEqual(buildAnswers(poll, values), [
  { questionId: 'one', optionId: 'a' }, { questionId: 'multi', optionId: 'c' }, { questionId: 'multi', optionId: 'd' }, { questionId: 'text', text: 'Ответ' },
])
assert.ok(validateResponses({ ...poll, kind: 'test' }, values).group)
assert.ok(validateResponses(poll, { ...values, texts: { text: ' ' } }).questions.text)
assert.ok(validateResponses(poll, { ...values, selected: { ...values.selected, one: ['a', 'b'] } }).questions.one)
assert.ok(validateResponses(poll, { ...values, name: ' ' }).name)
assert.ok(validateResponses(poll, { ...values, name: 'А'.repeat(151) }).name)
assert.ok(validateResponses(poll, { ...values, texts: { text: 'А'.repeat(4001) } }).questions.text)
assert.ok(validateResponses({ ...poll, kind: 'test' }, { ...values, group: 'Группа' }).questions.multi === undefined)

const calls = []
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  if (String(url).endsWith('/votes')) return new Response(null, { status: 204 })
  return new Response(JSON.stringify({ attemptId: 'attempt', accessSecret: 'secret' }), { status: 201, headers: { 'Content-Type': 'application/json' } })
}
await pollsApi.vote('poll', buildAnswers(poll, values), 'Иван')
assert.equal(calls[0].url, '/api/public/polls/poll/votes')
assert.equal(calls[0].options.credentials, 'include')
assert.equal(calls[0].options.headers.get('X-AnonPulse-Vote'), '1')
assert.equal(JSON.parse(calls[0].options.body).respondentName, 'Иван')
await pollsApi.vote('poll', buildAnswers(poll, values))
assert.equal('respondentName' in JSON.parse(calls[1].options.body), false)
const receipt = await pollsApi.submitTest('poll', { respondentName: 'Иван', respondentGroup: 'Группа', clientRequestId: 'uuid', answers: buildAnswers(poll, values) })
assert.equal(receipt.attemptId, 'attempt')
assert.equal(calls[2].url, '/api/public/polls/poll/test-submissions')
assert.equal(calls[2].options.headers.get('X-AnonPulse-Test'), '1')
assert.equal(calls[2].options.credentials, 'include')
assert.equal(JSON.parse(calls[2].options.body).clientRequestId, 'uuid')
for (const status of [400, 404, 409, 429]) {
  globalThis.fetch = async () => new Response(JSON.stringify({ title: 'Ошибка', status, code: status === 409 ? 'submission_already_stored_secret_unavailable' : undefined }), { status, headers: { 'Content-Type': 'application/problem+json' } })
  await assert.rejects(pollsApi.submitTest('poll', { respondentName: 'Иван', respondentGroup: 'Группа', clientRequestId: 'uuid', answers: buildAnswers(poll, values) }), error => error.status === status && (status !== 409 || error.problem?.code === 'submission_already_stored_secret_unavailable'))
}
globalThis.fetch = async () => { throw new Error('offline') }
await assert.rejects(pollsApi.submitTest('poll', { respondentName: 'Иван', respondentGroup: 'Группа', clientRequestId: 'uuid', answers: buildAnswers(poll, values) }), error => error.status === null)
console.log('Public response and API contract checks passed')
