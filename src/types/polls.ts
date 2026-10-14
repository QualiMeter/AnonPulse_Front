export type PollStatus = 'draft' | 'open' | 'closed'
export type PollOption = { id: string; text: string; position: number }
export type PollQuestion = { id: string; text: string; position: number; options: PollOption[] }
export type Poll = {
  id: string
  title: string | null
  status: PollStatus
  createdAt: string
  publishedAt: string | null
  closedAt: string | null
  questions: PollQuestion[]
}
export type ResultOption = PollOption & { voteCount: number; percentage: number }
export type PollResults = {
  id: string
  status: 'open' | 'closed'
  resultsType: 'interim' | 'final'
  totalParticipants: number
  questions: Array<Omit<PollQuestion, 'options'> & { options: ResultOption[] }>
}
export type PublicPoll = Pick<Poll, 'id' | 'title' | 'questions'>
export type Decision = { id: string; pollId: string; text: string; publishedAt: string }
