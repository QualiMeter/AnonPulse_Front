export type ResultQuestion = {
  id: string
  text: string
  position: number
  options: Array<{ id: string; text: string; position: number; voteCount: number; percentage: number }>
  type?: 'single_choice' | 'multiple_choice' | 'text'
  textAnswerCount?: number
}

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const plural = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10
  const mod100 = count % 100
  return `${count} ${mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many}`
}

function ResultBar({ option, rank, isEmpty }: { option: ResultQuestion['options'][number]; rank: number; isEmpty: boolean }) {
  const percent = numberFormatter.format(option.percentage)
  const votes = plural(option.voteCount, 'голос', 'голоса', 'голосов')
  return <div className="result-row"><div className="result-row__top"><span className="result-row__label">{option.text}</span><span className="result-row__value"><strong>{percent}%</strong><span>{votes}</span></span></div><div className="result-track" role="img" aria-label={`${option.text}: ${percent}%, ${votes}`}><span className={`result-track__fill result-track__fill--${rank % 3}`} style={{ width: isEmpty ? '0%' : `${Math.min(100, Math.max(0, option.percentage))}%` }} /></div></div>
}

export function ResultDistribution({ questions, totalParticipants }: { questions: ResultQuestion[]; totalParticipants: number }) {
  return <div className="result-questions">{[...questions].sort((a, b) => a.position - b.position).map((question, index) => <section className="result-card" key={question.id} aria-labelledby={`result-question-${question.id}`}><div className="result-card__head"><span>ВОПРОС {String(index + 1).padStart(2, '0')}</span><h3 id={`result-question-${question.id}`}>{question.text}</h3><p>{question.type === 'text' ? 'Текстовый ответ' : question.type === 'multiple_choice' ? 'Несколько вариантов' : 'Один вариант ответа'} · {plural(totalParticipants, 'участник', 'участника', 'участников')}</p></div>{question.type === 'text' ? <div className="result-card__rows"><p>{plural(question.textAnswerCount ?? 0, 'текстовый ответ', 'текстовых ответа', 'текстовых ответов')}</p></div> : <div className="result-card__rows">{[...question.options].sort((a, b) => a.position - b.position).map((item, rank) => <ResultBar key={item.id} option={item} rank={rank} isEmpty={totalParticipants === 0} />)}</div>}</section>)}</div>
}
