import { demoPolls } from '../../data/demoPolls'

// Публичная проекция общих демонстрационных опросов. Это не ответ сервера.
export type PublicOption = { id: string; text: string; position: number }
export type PublicQuestion = { id: string; text: string; position: number; options: PublicOption[] }
export type PublicPoll = { id: string; title: string | null; questions: PublicQuestion[] }

export const publicDemoIds = {
  open: '61b0c86e-98f0-4978-a948-a82064f55f71',
  secondOpen: '7f746f09-8d3e-41c8-8ea6-3cbbcc3c78ef',
  closed: 'a8ad6d3b-50bc-465d-9cd0-f77a2dd73051',
  closedEmpty: 'db7d14c2-32dc-45d6-8c79-91df146d348a',
  draft: 'b28dd6fc-c13e-4081-af59-03d29289ed2b',
} as const

export const demoPublicPolls: Record<string, PublicPoll> = Object.fromEntries(
  demoPolls.filter(poll => poll.status === 'open').map(poll => [poll.id, {
    id: poll.id,
    title: poll.title,
    questions: poll.questions,
  }]),
)
