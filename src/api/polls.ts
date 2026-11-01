import { ApiError, apiRequest } from './client'
import type { Decision, FeedbackAnalysis, GradeHistory, IdentifiedSubmission, KnowledgeJob, KnowledgeResults, PagedResponse, Poll, PollDraft, PollResults, PublicPoll, TestAttempt, TextAnswer } from '../types/polls'
export type { PollDraft } from '../types/polls'

export type PublicAnswer = { questionId: string; optionId: string } | { questionId: string; text: string }
export type TestSubmissionReceipt = { attemptId: string; accessSecret: string }

const pollPath = (id: string) => `/api/polls/${encodeURIComponent(id)}` as const
const publicPollPath = (id: string) => `/api/public/polls/${encodeURIComponent(id)}` as const
const analysisPath = (id: string, questionId: string) => `${pollPath(id)}/questions/${encodeURIComponent(questionId)}/feedback-analysis` as const
const attemptPath = (pollId: string, attemptId: string) => `${pollPath(pollId)}/test-attempts/${encodeURIComponent(attemptId)}` as const
const knowledgePath = (pollId: string, questionId: string) => `${pollPath(pollId)}/questions/${encodeURIComponent(questionId)}/knowledge-grading` as const
async function csrfToken() {
  const response = await apiRequest<{ token: string }>('/api/auth/csrf-token', { authRequired: true, cache: 'no-store' })
  if (!response?.token) throw new ApiError('Не удалось получить защитный токен.', null)
  return response.token
}

function requireMatchingAnalysis(value: FeedbackAnalysis, pollId: string, questionId: string) {
  if (!value || value.pollId?.toLowerCase() !== pollId.toLowerCase() || value.questionId?.toLowerCase() !== questionId.toLowerCase()) throw new ApiError('Сервер вернул анализ для другой формы или вопроса.', null)
  return value
}

export const pollsApi = {
  list: (signal?: AbortSignal) => apiRequest<Poll[]>('/api/polls', { signal, authRequired: true }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<Poll>(pollPath(id), { signal, authRequired: true }),
  create: (draft: PollDraft) => apiRequest<Poll>('/api/polls', { method: 'POST', body: draft, authRequired: true, expectedStatus: 201 }),
  update: (id: string, draft: PollDraft) => apiRequest<Poll>(pollPath(id), { method: 'PUT', body: draft, authRequired: true }),
  publish: (id: string) => apiRequest<Poll>(`${pollPath(id)}/publish`, { method: 'POST', authRequired: true }),
  close: (id: string) => apiRequest<Poll>(`${pollPath(id)}/close`, { method: 'POST', authRequired: true }),
  results: (id: string, signal?: AbortSignal, authRequired = false) => apiRequest<PollResults>(`${pollPath(id)}/results`, { signal, authRequired }),
  textAnswers: (id: string, questionId: string, page = 1, signal?: AbortSignal) => apiRequest<PagedResponse<TextAnswer>>(`${pollPath(id)}/questions/${encodeURIComponent(questionId)}/text-answers?page=${page}&pageSize=20`, { signal, authRequired: true, cache: 'no-store' }),
  submissions: (id: string, page = 1, signal?: AbortSignal) => apiRequest<PagedResponse<IdentifiedSubmission>>(`${pollPath(id)}/submissions?page=${page}&pageSize=20`, { signal, authRequired: true, cache: 'no-store' }),
  testAttempts: (id: string, page = 1, signal?: AbortSignal) => apiRequest<PagedResponse<TestAttempt>>(`${pollPath(id)}/test-attempts?page=${page}&pageSize=20`, { signal, authRequired: true, cache: 'no-store' }),
  gradeAnswer: async (pollId: string, attemptId: string, answerId: string, score: number) => apiRequest<{ answerId: string; score: number; gradingState: string }>(`${attemptPath(pollId, attemptId)}/answers/${encodeURIComponent(answerId)}/grade`, { method: 'PUT', body: { score, suggestionId: null }, headers: { 'X-CSRF-TOKEN': await csrfToken() }, authRequired: true, cache: 'no-store' }),
  acceptKnowledgeSuggestion: async (pollId: string, attemptId: string, answerId: string, suggestionId: string) => apiRequest<{ answerId: string; score: number; gradingState: string }>(`${attemptPath(pollId, attemptId)}/answers/${encodeURIComponent(answerId)}/grade`, { method: 'PUT', body: { score: null, suggestionId }, headers: { 'X-CSRF-TOKEN': await csrfToken() }, authRequired: true, cache: 'no-store' }),
  knowledgeJob: (pollId: string, questionId: string, signal?: AbortSignal) => apiRequest<KnowledgeJob>(knowledgePath(pollId, questionId), { signal, authRequired: true, cache: 'no-store' }),
  startKnowledgeJob: async (pollId: string, questionId: string) => apiRequest<KnowledgeJob>(knowledgePath(pollId, questionId), { method: 'POST', body: { externalProcessingConfirmed: true }, headers: { 'X-CSRF-TOKEN': await csrfToken() }, authRequired: true, expectedStatus: 202, cache: 'no-store' }),
  knowledgeResults: (pollId: string, questionId: string, page: number, signal?: AbortSignal) => apiRequest<KnowledgeResults>(`${knowledgePath(pollId, questionId)}/results?page=${page}&pageSize=100`, { signal, authRequired: true, cache: 'no-store' }),
  finalizeAttempt: async (pollId: string, attemptId: string) => apiRequest<{ attemptId: string; isFinal: boolean }>(`${attemptPath(pollId, attemptId)}/finalize`, { method: 'POST', headers: { 'X-CSRF-TOKEN': await csrfToken() }, authRequired: true, cache: 'no-store' }),
  gradeHistory: (pollId: string, attemptId: string, signal?: AbortSignal) => apiRequest<GradeHistory>(`${attemptPath(pollId, attemptId)}/grade-history`, { signal, authRequired: true, cache: 'no-store' }),
  feedbackAnalysis: async (id: string, questionId: string, signal?: AbortSignal) => requireMatchingAnalysis(await apiRequest<FeedbackAnalysis>(analysisPath(id, questionId), { signal, authRequired: true, cache: 'no-store' }), id, questionId),
  startFeedbackAnalysis: async (id: string, questionId: string) => {
    const csrf = await apiRequest<{ token: string }>('/api/auth/csrf-token', { authRequired: true, cache: 'no-store' })
    if (!csrf || typeof csrf.token !== 'string' || !csrf.token) throw new ApiError('Не удалось получить защитный токен. Попробуйте ещё раз.', null)
    return requireMatchingAnalysis(await apiRequest<FeedbackAnalysis>(analysisPath(id, questionId), { method: 'POST', body: { externalProcessingConfirmed: true }, headers: { 'X-CSRF-TOKEN': csrf.token }, authRequired: true, expectedStatus: 202, cache: 'no-store' }), id, questionId)
  },
  decision: (id: string, signal?: AbortSignal) => apiRequest<Decision>(`${pollPath(id)}/decision`, { signal }),
  putDecision: (id: string, text: string) => apiRequest<Decision>(`${pollPath(id)}/decision`, { method: 'PUT', body: { text }, authRequired: true }),
  publicPoll: (id: string, signal?: AbortSignal) => apiRequest<PublicPoll>(publicPollPath(id), { signal }),
  vote: (id: string, answers: PublicAnswer[], respondentName?: string) => apiRequest<void>(`${publicPollPath(id)}/votes`, { method: 'POST', body: { answers, ...(respondentName === undefined ? {} : { respondentName }) }, headers: { 'X-AnonPulse-Vote': '1' }, expectedStatus: 204 }),
  submitTest: async (id: string, body: { respondentName: string; respondentGroup: string; clientRequestId: string; answers: PublicAnswer[] }) => {
    const receipt = await apiRequest<TestSubmissionReceipt>(`${publicPollPath(id)}/test-submissions`, { method: 'POST', body, headers: { 'X-AnonPulse-Test': '1' }, expectedStatus: 201 })
    if (!receipt || typeof receipt.attemptId !== 'string' || typeof receipt.accessSecret !== 'string' || !receipt.attemptId || !receipt.accessSecret) throw new ApiError('Сервер вернул неполное подтверждение попытки.', 201)
    return receipt
  },
}
