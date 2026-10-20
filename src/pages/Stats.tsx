import { useData } from '../data'
import { buildStats } from '../lib/scoring'

const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`)

export default function Stats() {
  const { players, matches, predictions } = useData()
  const rows = buildStats(players, matches, predictions).sort((a, b) => b.hitRate - a.hitRate || b.played - a.played)
  return (
    <div className="stack">
      <h2 className="section">Estadísticas</h2>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th className="left">Jugador</th>
              <th>% acierto</th>
              <th>Suiza</th>
              <th>Elim.</th>
              <th>Exactos</th>
              <th title="Racha actual">Racha</th>
              <th title="Mejor racha">Mejor</th>
              <th title="Aciertos cuando la mayoría falló">Contra corriente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player.id}>
                <td className="left">
                  {r.player.emoji} {r.player.name}
                </td>
                <td className="strong">
                  {pct(r.played ? r.hitRate : null)} <span className="muted small">({r.winners}/{r.played})</span>
                </td>
                <td>{pct(r.swissHitRate)}</td>
                <td>{pct(r.playoffHitRate)}</td>
                <td>{r.exacts}</td>
                <td>{r.currentStreak ? `🔥${r.currentStreak}` : 0}</td>
                <td>{r.bestStreak}</td>
                <td>{r.contrarian}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">La racha cuenta aciertos de ganador seguidos, en orden de partido.</p>
    </div>
  )
}
