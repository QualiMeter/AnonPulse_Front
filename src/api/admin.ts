import { apiRequest } from './client'

export type Page<T> = { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }
export type AdminDashboard = { users: { total: number; active: number; blocked: number; byRole: Array<{ role: string; count: number }> }; polls: { total: number; draft: number; open: number; closed: number; withPublishedDecisions: number }; totalParticipations: number; pollCreationLast30Days: Array<{ date: string; count: number }> }
export type AdminUser = { id: string; email: string; roles: string[]; isDeactivated: boolean; lockoutEnd?: string | null; pollCount?: number; decisionCount?: number; createdAt?: string }
export type AdminPoll = { id: string; title?: string | null; kind?: 'survey' | 'test'; status: 'draft' | 'open' | 'closed'; creatorId?: string; createdAt?: string; questions?: Array<{ id: string; text: string; position: number; options?: Array<{ id: string; text: string; position: number }> }> }
export type AuditEvent = { id: string; administratorId?: string; actorId?: string; actionType: string; targetType: string; targetId: string; createdAt?: string; occurredAt?: string; metadata?: Record<string, unknown> }

const query = (values: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '').map(([key, value]) => [key, String(value)])).toString()
const path = (section: string, values: Record<string, string | number | undefined>) => `/api/admin/${section}?${query(values)}` as `/api/${string}`
const byId = (section: string, id: string) => `/api/admin/${section}/${encodeURIComponent(id)}` as `/api/${string}`
async function csrf() { const value = await apiRequest<{ token: string }>('/api/auth/csrf-token', { authRequired: true, cache: 'no-store' }); return value.token }

export const adminApi = {
  dashboard: (signal?: AbortSignal) => apiRequest<AdminDashboard>('/api/admin/dashboard', { signal, authRequired: true, cache: 'no-store' }),
  users: (values: Record<string, string | number | undefined>, signal?: AbortSignal) => apiRequest<Page<AdminUser>>(path('users', values), { signal, authRequired: true, cache: 'no-store' }),
  user: (id: string, signal?: AbortSignal) => apiRequest<AdminUser>(byId('users', id), { signal, authRequired: true, cache: 'no-store' }),
  setUserStatus: async (id: string, isDeactivated: boolean) => apiRequest<AdminUser>(`${byId('users', id)}/status`, { method: 'PATCH', body: { isDeactivated }, headers: { 'X-CSRF-TOKEN': await csrf() }, authRequired: true, cache: 'no-store' }),
  deleteUser: async (id: string) => apiRequest<void>(byId('users', id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': await csrf() }, authRequired: true, cache: 'no-store' }),
  polls: (values: Record<string, string | number | undefined>, signal?: AbortSignal) => apiRequest<Page<AdminPoll>>(path('polls', values), { signal, authRequired: true, cache: 'no-store' }),
  poll: (id: string, signal?: AbortSignal) => apiRequest<AdminPoll>(byId('polls', id), { signal, authRequired: true, cache: 'no-store' }),
  deletePoll: async (id: string, confirm: boolean) => apiRequest<void>(`${byId('polls', id)}${confirm ? '?confirm=true' : ''}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': await csrf() }, authRequired: true, cache: 'no-store' }),
  audit: (values: Record<string, string | number | undefined>, signal?: AbortSignal) => apiRequest<Page<AuditEvent>>(path('audit', values), { signal, authRequired: true, cache: 'no-store' }),
}
