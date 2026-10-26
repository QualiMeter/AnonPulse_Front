import { ApiError, apiRequest } from './client'
import type { Decision, Poll, PollDraft, PollResults, PublicPoll } from '../types/polls'
export type { PollDraft } from '../types/polls'

export type PublicAnswer = { questionId: string; optionId: string } | { questionId: string; text: string }
export type TestSubmissionReceipt = { attemptId: string; accessSecret: string }

const pollPath = (id: string) => `/api/polls/${encodeURIComponent(id)}` as const
const publicPollPath = (id: string) => `/api/public/polls/${encodeURIComponent(id)}` as const

export const pollsApi = {
  list: (signal?: AbortSignal) => apiRequest<Poll[]>('/api/polls', { signal, authRequired: true }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<Poll>(pollPath(id), { signal, authRequired: true }),
  create: (draft: PollDraft) => apiRequest<Poll>('/api/polls', { method: 'POST', body: draft, authRequired: true, expectedStatus: 201 }),
  update: (id: string, draft: PollDraft) => apiRequest<Poll>(pollPath(id), { method: 'PUT', body: draft, authRequired: true }),
  publish: (id: string) => apiRequest<Poll>(`${pollPath(id)}/publish`, { method: 'POST', authRequired: true }),
  close: (id: string) => apiRequest<Poll>(`${pollPath(id)}/close`, { method: 'POST', authRequired: true }),
  results: (id: string, signal?: AbortSignal, authRequired = false) => apiRequest<PollResults>(`${pollPath(id)}/results`, { signal, authRequired }),
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
