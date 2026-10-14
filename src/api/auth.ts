import { apiRequest } from './client'

export type CurrentUser = {
  id: string
  email: string
  roles: string[]
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (typeof value !== 'object' || value === null) return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string' && typeof user.email === 'string' &&
    Array.isArray(user.roles) && user.roles.every(role => typeof role === 'string')
}

async function requireUser(request: Promise<unknown>): Promise<CurrentUser> {
  const user = await request
  if (!isCurrentUser(user)) throw new Error('Сервер вернул некорректные данные пользователя.')
  return user
}

export const authApi = {
  login: (email: string, password: string) => requireUser(apiRequest<unknown>('/api/auth/login', { method: 'POST', body: { email, password } })),
  me: (signal?: AbortSignal) => requireUser(apiRequest<unknown>('/api/auth/me', { signal })),
  logout: () => apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST' }),
}
