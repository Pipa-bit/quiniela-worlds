import TeamLogo from '../components/TeamLogo'
import { useData } from '../data'
import { swissStandings } from '../lib/scoring'
import { STAGE_LABEL, type Match } from '../lib/types'

export default function Tournament() {
  const { teams, matches, team } = useData()
  const rows = swissStandings(teams, matches)
  const playoffs = (['qf', 'sf', 'final'] as const).map((s) => [s, matches.filter((m) => m.stage === s)] as const)

  return (
    <div className="stack">
      <h2 className="section">Fase suiza</h2>
      {rows.length === 0 ? (
        <p className="empty">Aún no hay partidos de la suiza.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th className="left">Equipo</th>
              <th>V-D</th>
              <th className="left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className={r.status}>
                <td className="left team-cell">
                  <TeamLogo team={r.team} size={24} /> {r.team.short}
                </td>
                <td className="strong">
                  {r.wins}-{r.losses}
                </td>
                <td className="left small">
                  {r.status === 'qualified' ? '✅ Clasificado' : r.status === 'eliminated' ? '❌ Eliminado' : 'En juego'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section">Eliminatorias</h2>
      <div className="bracket">
        {playoffs.map(([stage, list]) => (
          <div key={stage} className="bracket-col">
            <h3 className="day">{STAGE_LABEL[stage]}</h3>
            {list.length === 0 && <div className="bracket-match muted small">Por decidir</div>}
            {list.map((m) => (
              <BracketMatch key={m.id} m={m} team={team} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketMatch({ m, team }: { m: Match; team: ReturnType<typeof useData>['team'] }) {
  const done = m.score_a != null
  const line = (id: number, score: number | null, other: number | null) => (
    <div className={`bracket-team ${done && score! > other! ? 'won' : ''}`}>
      <TeamLogo team={team(id)} size={20} />
      <span>{team(id)?.short}</span>
      <b>{done ? score : ''}</b>
    </div>
  )
  return (
    <div className="bracket-match">
      {line(m.team_a, m.score_a, m.score_b)}
      {line(m.team_b, m.score_b, m.score_a)}
    </div>
  )
}
