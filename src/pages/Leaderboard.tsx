import { useData } from '../data'
import { buildLeaderboard } from '../lib/scoring'
import type { Player } from '../lib/types'

export default function Leaderboard({ me }: { me: Player }) {
  const { players, matches, predictions } = useData()
  const rows = buildLeaderboard(players, matches, predictions)
  return (
    <div className="stack">
      <h2 className="section">Clasificación</h2>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Jugador</th>
            <th>Pts</th>
            <th title="Aciertos de ganador">Acierto</th>
            <th title="Resultados exactos">Exacto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} className={r.player.id === me.id ? 'me' : ''}>
              <td>
                {r.position}
                <Arrow change={r.change} />
              </td>
              <td className="left">
                {r.player.emoji} {r.player.name}
              </td>
              <td className="strong">{r.points}</td>
              <td>{r.winners}</td>
              <td>{r.exacts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        +1 por acertar el ganador, +1 extra por el resultado exacto (Bo3/Bo5). Desempate: más exactos, más aciertos, orden
        alfabético. Las flechas comparan con la jornada anterior.
      </p>
    </div>
  )
}

function Arrow({ change }: { change: number | null }) {
  if (change == null || change === 0) return null
  return <span className={`arrow ${change > 0 ? 'up' : 'down'}`}>{change > 0 ? `▲${change}` : `▼${-change}`}</span>
}
