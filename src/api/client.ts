export type ProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly problem?: ProblemDetails,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asProblem(value: unknown): ProblemDetails | undefined {
  if (!isRecord(value)) return undefined
  const errors = isRecord(value.errors)
    ? Object.fromEntries(Object.entries(value.errors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(item => typeof item === 'string')))
    : undefined
  return {
    type: typeof value.type === 'string' ? value.type : undefined,
    title: typeof value.title === 'string' ? value.title : undefined,
    status: typeof value.status === 'number' ? value.status : undefined,
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    errors,
  }
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

type ApiOptions = Omit<RequestInit, 'body' | 'credentials'> & { body?: unknown; authRequired?: boolean; expectedStatus?: number }

export async function apiRequest<T>(path: `/api/${string}`, options: ApiOptions = {}): Promise<T> {
  const { body, authRequired, expectedStatus, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.', null)
  }

  const raw = response.status === 204 || response.status === 205 ? '' : await response.text()
  let data: unknown
  try { data = raw ? JSON.parse(raw) : undefined } catch { data = undefined }

  if (!response.ok) {
    const problem = asProblem(data)
    if (response.status === 401 && authRequired) window.dispatchEvent(new Event('anonpulse:session-expired'))
    throw new ApiError(problem?.detail || problem?.title || `Ошибка сервера (${response.status})`, response.status, problem, retryAfterSeconds(response.headers.get('Retry-After')))
  }

  if (expectedStatus && response.status !== expectedStatus) throw new ApiError(`Неожиданный ответ сервера (${response.status}).`, response.status)

  if (raw && data === undefined) throw new ApiError('Сервер вернул некорректный ответ.', response.status)
  return data as T
}
