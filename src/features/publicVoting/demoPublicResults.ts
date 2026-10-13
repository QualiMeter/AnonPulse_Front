import type { ResultQuestion } from '../../components/ResultDistribution'
import { demoPolls, demoResults, type Poll, type PollResults } from '../../data/demoPolls'

// Итоговая публичная проекция общих демонстрационных данных. Это не ответ API.
export type PublicFinalResults = {
  id: string
  title: string | null
  status: 'closed'
  resultsType: 'final'
  totalParticipants: number
  questions: ResultQuestion[]
}

export function publicFinalResults(poll?: Poll, results?: PollResults): PublicFinalResults | undefined {
  if (!poll || poll.status !== 'closed' || !results || results.resultsType !== 'final') return undefined
  return {
    id: poll.id,
    title: poll.title,
    status: 'closed',
    resultsType: 'final',
    totalParticipants: results.totalParticipants,
    questions: results.questions,
  }
}

export const demoPublicResults: Record<string, PublicFinalResults> = Object.fromEntries(
  demoPolls.map(poll => [poll.id, publicFinalResults(poll, demoResults[poll.id])])
    .filter((entry): entry is [string, PublicFinalResults] => Boolean(entry[1])),
)
