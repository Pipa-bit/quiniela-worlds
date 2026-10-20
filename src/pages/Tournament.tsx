import TeamLogo from '../components/TeamLogo'
import { useData } from '../data'
import { arrangeBracket, swissStandings, winnerId } from '../lib/scoring'
import type { Match } from '../lib/types'

export default function Tournament() {
  const { teams, matches } = useData()
  const rows = swissStandings(teams, matches)

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
      <Bracket />
    </div>
  )
}

type TeamFn = ReturnType<typeof useData>['team']

const CARD_H = 62 // alto de cada cruce (px)
const GAP_Y = 14 // separación vertical entre cuartos

/** Columna i (0-2) dentro del ancho disponible, con la separación horizontal en --gx. */
const colLeft = (i: number) => `calc((100% - 2 * var(--gx)) / 3 * ${i} + var(--gx) * ${i})`
const colRight = (i: number) => `calc((100% - 2 * var(--gx)) / 3 * ${i + 1} + var(--gx) * ${i})`

function Bracket() {
  const { matches, team } = useData()
  const { qf, sf, final } = arrangeBracket(matches)
  const qfTop = [0, 1, 2, 3].map((i) => i * (CARD_H + GAP_Y))
  const center = (top: number) => top + CARD_H / 2
  const sfTop = [0, 1].map((k) => (center(qfTop[2 * k]) + center(qfTop[2 * k + 1])) / 2 - CARD_H / 2)
  const finalTop = (center(sfTop[0]) + center(sfTop[1])) / 2 - CARD_H / 2
  const height = qfTop[3] + CARD_H
  const champ = winnerId(final)

  // Conector "]" que une dos cruces de la columna c con el siguiente
  const joint = (c: number, y1: number, y2: number, key: string) => [
    <div key={`${key}-a`} className="b-join" style={{ left: colRight(c), top: y1, height: y2 - y1 }} />,
    <div key={`${key}-b`} className="b-stem" style={{ left: `calc(${colRight(c)} + var(--gx) / 2)`, top: (y1 + y2) / 2 }} />,
  ]

  return (
    <div className="bracket-scroll">
      <div className="bracket-tree" style={{ height }}>
        <div className="b-label" style={{ left: colLeft(0) }}>Cuartos</div>
        <div className="b-label" style={{ left: colLeft(1) }}>Semis</div>
        <div className="b-label" style={{ left: colLeft(2) }}>Final</div>

        {joint(0, center(qfTop[0]), center(qfTop[1]), 'q0')}
        {joint(0, center(qfTop[2]), center(qfTop[3]), 'q1')}
        {joint(1, center(sfTop[0]), center(sfTop[1]), 's')}

        {qf.map((m, i) => (
          <BracketMatch key={`qf${i}`} m={m} team={team} style={{ left: colLeft(0), top: qfTop[i] }} delay={i} />
        ))}
        {sf.map((m, i) => (
          <BracketMatch key={`sf${i}`} m={m} team={team} style={{ left: colLeft(1), top: sfTop[i] }} delay={4 + i} />
        ))}
        <BracketMatch m={final} team={team} style={{ left: colLeft(2), top: finalTop }} delay={6} isFinal />

        <div className={`b-champ ${champ ? 'set' : ''}`} style={{ left: colLeft(2), top: finalTop - 92 }}>
          <span className="b-trophy">🏆</span>
          {champ ? (
            <>
              <TeamLogo team={team(champ)} size={26} />
              <b>{team(champ)?.short}</b>
            </>
          ) : (
            <span className="muted small">Campeón</span>
          )}
        </div>
      </div>
    </div>
  )
}

function BracketMatch({
  m, team, style, delay, isFinal,
}: {
  m: Match | null
  team: TeamFn
  style: React.CSSProperties
  delay: number
  isFinal?: boolean
}) {
  const done = m != null && m.score_a != null && m.score_b != null
  const w = winnerId(m)
  const line = (id: number | undefined, score: number | null | undefined) => (
    <div className={`bracket-team ${done ? (id === w ? 'won' : 'lost') : ''}`}>
      {id != null ? <TeamLogo team={team(id)} size={20} /> : <span className="b-slot" />}
      <span className="b-name">{id != null ? team(id)?.short : '—'}</span>
      <b>{done ? score : ''}</b>
    </div>
  )
  return (
    <div
      className={`bracket-match fade-in ${isFinal ? 'final' : ''} ${m ? '' : 'tbd'}`}
      style={{ ...style, height: CARD_H, animationDelay: `${delay * 50}ms` }}
    >
      {line(m?.team_a, m?.score_a)}
      {line(m?.team_b, m?.score_b)}
    </div>
  )
}
