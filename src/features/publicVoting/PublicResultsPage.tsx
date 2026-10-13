import { ResultDistribution } from '../../components/ResultDistribution'
import { Icon } from '../../components/Icon'
import { AppLink } from '../../components/AppLink'
import type { PublicFinalResults } from './demoPublicResults'
import { PublicFrame } from './PublicFrame'
import './publicResults.css'

const participantLabel = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'участник' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'участника' : 'участников'

export default function PublicResultsPage({ id, results, decision, navigate }: { id: string; results?: PublicFinalResults; decision?: string; navigate: (to: string) => void }) {
  // Публичная страница принимает только подтверждённые итоговые фикстуры.
  // Будущий API должен подтверждать закрытие через final results, а не по одному 409 публичного GET.
  if (!results || results.status !== 'closed' || results.resultsType !== 'final') {
    return <PublicFrame id={id} compact><section className="vote-state public-results-unavailable" aria-labelledby="public-results-unavailable-title"><span className="vote-state__icon"><Icon name="lock" size={25} /></span><p className="vote-eyebrow">ИТОГИ ПОКА НЕДОСТУПНЫ</p><h1 id="public-results-unavailable-title">Результаты не опубликованы</h1><div className="vote-state__body"><p>Студенты видят статистику только после завершения опроса. По этой ссылке итоговые результаты пока не подтверждены.</p><p className="vote-state__aside">Промежуточные результаты активного опроса доступны только преподавателю и администратору.</p></div></section></PublicFrame>
  }

  const title = results.title?.trim() || results.questions[0]?.text || 'Опрос без названия'
  return <PublicFrame id={id}><div className="public-results"><AppLink to={`/p/${id}`} navigate={navigate} className="public-results__back"><Icon name="arrowLeft" size={16} />К странице опроса</AppLink><div className="public-results__heading"><div><p className="vote-eyebrow">ИТОГИ ОБРАТНОЙ СВЯЗИ</p><h1>{title}</h1><p>Голосование завершено. Ниже — только общие результаты, без индивидуальных ответов.</p></div><span className="public-results__status"><Icon name="check" size={15} />Завершён</span></div>
    <section className="public-results__summary" aria-label="Участники опроса"><div><span className="public-results__count">{results.totalParticipants}</span><div><strong>{participantLabel(results.totalParticipants)}</strong><p>{results.totalParticipants === 0 ? 'пока нет ответов' : 'ответили на этот опрос'}</p></div></div><span>{results.questions.length} {results.questions.length === 1 ? 'вопрос' : results.questions.length < 5 ? 'вопроса' : 'вопросов'}</span></section>
    <section className="public-results__distribution" aria-labelledby="public-results-questions"><div className="public-results__section-head"><p className="vote-eyebrow">РАСПРЕДЕЛЕНИЕ ОТВЕТОВ</p><h2 id="public-results-questions">Результаты по вопросам</h2></div>{results.totalParticipants === 0 && <div className="zero-results"><Icon name="barChart" size={19} /><span>Ответов нет. Для всех вариантов показано 0 голосов.</span></div>}<ResultDistribution questions={results.questions} totalParticipants={results.totalParticipants} /></section>
    <section className="public-results__decision" aria-labelledby="public-results-decision"><span className="public-results__decision-icon"><Icon name={decision ? 'check' : 'info'} size={20} /></span><div><p className="vote-eyebrow">ЧТО ИЗМЕНИТСЯ</p><h2 id="public-results-decision">Решение преподавателя</h2>{decision ? <p className="public-results__decision-text">{decision}</p> : <p className="public-results__decision-empty">Решение по итогам опроса пока не опубликовано. Здесь появится текст преподавателя, когда он будет готов.</p>}</div></section>
    <p className="public-results__demo"><Icon name="info" size={16} />Это демонстрационные результаты. Данные сервера не загружаются, а изменения решения видны только в текущей вкладке.</p>
  </div></PublicFrame>
}
