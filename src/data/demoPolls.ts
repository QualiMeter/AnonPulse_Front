// Локальные демонстрационные данные для согласования интерфейса. Это не ответы API.
import type { Poll, PollOption, PollResults } from '../types/polls'
export type { Poll, PollOption, PollQuestion, PollStatus, ResultOption, PollResults } from '../types/polls'

const option = (id: string, text: string, position: number): PollOption => ({ id, text, position })

export const demoPolls: Poll[] = [
  {
    id: '61b0c86e-98f0-4978-a948-a82064f55f71',
    title: 'Обратная связь по курсу «Введение в анализ данных»',
    status: 'open',
    createdAt: '2026-10-11T09:20:00Z',
    publishedAt: '2026-10-12T07:30:00Z',
    closedAt: null,
    questions: [
      {
        id: 'q-analysis-1', text: 'Насколько понятны объяснения на лекциях?', position: 0,
        options: [option('a1-1', 'Всё понятно', 0), option('a1-2', 'Иногда нужны пояснения', 1), option('a1-3', 'Часто сложно разобраться', 2)],
      },
      {
        id: 'q-analysis-2', text: 'Хватает ли времени на практические задания?', position: 1,
        options: [option('a2-1', 'Да, времени достаточно', 0), option('a2-2', 'Не всегда хватает', 1), option('a2-3', 'Времени слишком мало', 2)],
      },
      {
        id: 'q-analysis-3', text: 'Какой формат разбора ошибок полезнее?', position: 2,
        options: [option('a3-1', 'Короткий разбор на занятии', 0), option('a3-2', 'Письменные комментарии', 1), option('a3-3', 'Отдельная консультация', 2)],
      },
    ],
  },
  {
    id: '7f746f09-8d3e-41c8-8ea6-3cbbcc3c78ef',
    title: 'Формат консультаций перед экзаменом',
    status: 'open',
    createdAt: '2026-10-09T11:10:00Z',
    publishedAt: '2026-10-10T08:00:00Z',
    closedAt: null,
    questions: [
      {
        id: 'q-consult-1', text: 'Как вам удобнее участвовать в консультации?', position: 0,
        options: [option('c1-1', 'Очно в аудитории', 0), option('c1-2', 'Онлайн', 1)],
      },
      {
        id: 'q-consult-2', text: 'Когда лучше провести консультацию?', position: 1,
        options: [option('c2-1', 'За неделю до экзамена', 0), option('c2-2', 'За два дня до экзамена', 1)],
      },
    ],
  },
  {
    id: 'a8ad6d3b-50bc-465d-9cd0-f77a2dd73051',
    title: 'Практические занятия по дизайну интерфейсов',
    status: 'closed',
    createdAt: '2026-09-26T06:45:00Z',
    publishedAt: '2026-09-27T08:00:00Z',
    closedAt: '2026-10-08T15:00:00Z',
    questions: [
      {
        id: 'q-design-1', text: 'Достаточно ли примеров на занятиях?', position: 0,
        options: [option('d1-1', 'Да, примеров достаточно', 0), option('d1-2', 'Хотелось бы больше', 1), option('d1-3', 'Примеры не помогают', 2)],
      },
      {
        id: 'q-design-2', text: 'Что стоит изменить в практических заданиях?', position: 1,
        options: [option('d2-1', 'Добавить больше времени', 0), option('d2-2', 'Давать более подробный бриф', 1), option('d2-3', 'Оставить как есть', 2)],
      },
    ],
  },
  {
    id: 'db7d14c2-32dc-45d6-8c79-91df146d348a',
    title: null,
    status: 'closed',
    createdAt: '2026-10-05T08:15:00Z',
    publishedAt: '2026-10-06T08:00:00Z',
    closedAt: '2026-10-09T16:30:00Z',
    questions: [
      {
        id: 'q-empty-1', text: 'Нужны ли дополнительные материалы после занятия?', position: 0,
        options: [option('e1-1', 'Да, нужны', 0), option('e1-2', 'Нет, достаточно текущих', 1)],
      },
    ],
  },
  {
    id: 'b28dd6fc-c13e-4081-af59-03d29289ed2b',
    title: null,
    status: 'draft',
    createdAt: '2026-10-07T10:00:00Z',
    publishedAt: null,
    closedAt: null,
    questions: [
      {
        id: 'q-draft-1', text: 'Какие темы стоит повторить перед зачётом?', position: 0,
        options: [option('dr1-1', 'Основы статистики', 0), option('dr1-2', 'Визуализация данных', 1), option('dr1-3', 'Работа с таблицами', 2)],
      },
      {
        id: 'q-draft-2', text: 'Как удобнее повторять материал?', position: 1,
        options: [option('dr2-1', 'На занятии', 0), option('dr2-2', 'По материалам для самостоятельной работы', 1)],
      },
    ],
  },
]

export const demoResults: Record<string, PollResults> = {
  [demoPolls[0].id]: {
    id: demoPolls[0].id, status: 'open', resultsType: 'interim', totalParticipants: 46,
    questions: [
      {
        ...demoPolls[0].questions[0],
        options: [
          { ...demoPolls[0].questions[0].options[0], voteCount: 24, percentage: 52.17 },
          { ...demoPolls[0].questions[0].options[1], voteCount: 17, percentage: 36.96 },
          { ...demoPolls[0].questions[0].options[2], voteCount: 5, percentage: 10.87 },
        ],
      },
      {
        ...demoPolls[0].questions[1],
        options: [
          { ...demoPolls[0].questions[1].options[0], voteCount: 12, percentage: 26.09 },
          { ...demoPolls[0].questions[1].options[1], voteCount: 26, percentage: 56.52 },
          { ...demoPolls[0].questions[1].options[2], voteCount: 8, percentage: 17.39 },
        ],
      },
      {
        ...demoPolls[0].questions[2],
        options: [
          { ...demoPolls[0].questions[2].options[0], voteCount: 19, percentage: 41.3 },
          { ...demoPolls[0].questions[2].options[1], voteCount: 21, percentage: 45.65 },
          { ...demoPolls[0].questions[2].options[2], voteCount: 6, percentage: 13.04 },
        ],
      },
    ],
  },
  [demoPolls[1].id]: {
    id: demoPolls[1].id, status: 'open', resultsType: 'interim', totalParticipants: 0,
    questions: demoPolls[1].questions.map(question => ({
      ...question, options: question.options.map(item => ({ ...item, voteCount: 0, percentage: 0 })),
    })),
  },
  [demoPolls[2].id]: {
    id: demoPolls[2].id, status: 'closed', resultsType: 'final', totalParticipants: 32,
    questions: [
      {
        ...demoPolls[2].questions[0],
        options: [
          { ...demoPolls[2].questions[0].options[0], voteCount: 12, percentage: 37.5 },
          { ...demoPolls[2].questions[0].options[1], voteCount: 18, percentage: 56.25 },
          { ...demoPolls[2].questions[0].options[2], voteCount: 2, percentage: 6.25 },
        ],
      },
      {
        ...demoPolls[2].questions[1],
        options: [
          { ...demoPolls[2].questions[1].options[0], voteCount: 7, percentage: 21.88 },
          { ...demoPolls[2].questions[1].options[1], voteCount: 20, percentage: 62.5 },
          { ...demoPolls[2].questions[1].options[2], voteCount: 5, percentage: 15.63 },
        ],
      },
    ],
  },
  [demoPolls[3].id]: {
    id: demoPolls[3].id, status: 'closed', resultsType: 'final', totalParticipants: 0,
    questions: demoPolls[3].questions.map(question => ({
      ...question, options: question.options.map(item => ({ ...item, voteCount: 0, percentage: 0 })),
    })),
  },
}

export const demoDecisions: Record<string, string> = {
  [demoPolls[2].id]: 'Добавим к каждому практическому заданию короткий бриф с ожидаемым результатом и критериями оценки. Первый обновлённый бриф появится на следующей неделе.',
}
