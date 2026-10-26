export type PollStatus = 'draft' | 'open' | 'closed'
export type PollKind = 'survey' | 'test'
export type ResponseMode = 'anonymous' | 'identified'
export type QuestionType = 'single_choice' | 'multiple_choice' | 'text'
export type TextPurpose = 'feedback' | 'knowledge'
export type TestScale = 5 | 10 | 12 | 100

export type PollOption = { id: string; text: string; position: number }
export type KnowledgeSettings = { expectedAnswer: string; gradingCriteria: string; maxScore: number }

// Protected teacher response. Older polls may omit the newer fields.
export type PollQuestion = {
  id: string
  text: string
  position: number
  options: PollOption[]
  type?: QuestionType
  allowsMultipleAnswers?: boolean
  textPurpose?: TextPurpose | null
  knowledgeSettings?: KnowledgeSettings | null
  weight?: number | null
  correctOptionIds?: string[] | null
}
export type Poll = {
  id: string
  title: string | null
  status: PollStatus
  createdAt: string
  publishedAt: string | null
  closedAt: string | null
  questions: PollQuestion[]
  kind?: PollKind
  responseMode?: ResponseMode
  testScale?: TestScale | null
}

// Public response deliberately has no answer key, weight or knowledge settings.
export type PublicPollQuestion = { id: string; text: string; position: number; options: PollOption[]; type?: QuestionType; allowsMultipleAnswers?: boolean; textPurpose?: TextPurpose | null }
export type PublicPoll = {
  id: string
  title: string | null
  kind?: PollKind
  responseMode?: ResponseMode
  testScale?: TestScale | null
  questions: PublicPollQuestion[]
}

export type ChoiceQuestionDraft = { text: string; type: 'single_choice' | 'multiple_choice'; options: string[]; weight?: number; correctOptionIndexes?: number[] }
export type TextQuestionDraft = { text: string; type: 'text'; textPurpose: TextPurpose; options: []; knowledgeSettings?: KnowledgeSettings }
export type PollDraft = { title: string | null; kind: PollKind; responseMode: ResponseMode; testScale: TestScale | null; questions: Array<ChoiceQuestionDraft | TextQuestionDraft> }

export type ResultOption = PollOption & { voteCount: number; percentage: number }
export type PollResults = {
  id: string
  status: 'open' | 'closed'
  resultsType: 'interim' | 'final'
  totalParticipants: number
  questions: Array<{ id: string; text: string; position: number; type?: QuestionType; allowsMultipleAnswers?: boolean; textPurpose?: TextPurpose | null; textAnswerCount?: number; options: ResultOption[] }>
}
export type Decision = { id: string; pollId: string; text: string; publishedAt: string }

export function getPollKind(poll: Pick<Poll, 'kind'> | Pick<PublicPoll, 'kind'>): PollKind { return poll.kind ?? 'survey' }
export function getResponseMode(poll: Pick<Poll, 'responseMode'> | Pick<PublicPoll, 'responseMode'>): ResponseMode { return poll.responseMode ?? 'anonymous' }
export function getQuestionType(question: Pick<PollQuestion, 'type' | 'allowsMultipleAnswers'>): QuestionType {
  return question.type ?? (question.allowsMultipleAnswers ? 'multiple_choice' : 'single_choice')
}
