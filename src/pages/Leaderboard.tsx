import { useState } from 'react'
import { useData } from '../data'
import { buildLeaderboard, positionHistory, type HistoryStep, type Standing } from '../lib/scoring'
import { dayTitle, madridDay } from '../lib/time'
import type { Player } from '../lib/types'

/** Colores para los jugadores que no tienen uno elegido en el admin. */
const PALETTE = ['#c8aa6e', '#0ac8b9', '#7c5cff', '#ff7a59', '#3ecf8e', '#ff5c9d', '#5aa9ff', '#f5d76e', '#b07cff', '#9fd356']

export function playerColor(p: Player, index: number): string {
  return p.color || PALETTE[index % PALETTE.length]
}

export default function Leaderboard({ me }: { me: Player }) {
  const { players, matches, predictions } = useData()
  const rows = buildLeaderboard(players, matches, predictions)
  const history = positionHistory(players, matches, predictions)
  const colorOf = new Map(players.map((p, i) => [p.id, playerColor(p, i)]))
  const started = history.length > 0

  return (
    <div className="stack">
      <h2 className="section">Clasificación</h2>
      {started && rows.length >= 3 && <Podium rows={rows.slice(0, 3)} me={me} />}
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
          {rows.map((r, i) => (
            <tr key={r.player.id} className={`fade-in ${r.player.id === me.id ? 'me' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              <td>
                <span className={`pos ${started && r.position <= 3 ? `pos-${r.position}` : ''}`}>{r.position}</span>
                <Arrow change={r.change} />
              </td>
              <td className="left">
                <span className="dot" style={{ background: colorOf.get(r.player.id) }} />
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

      <h2 className="section">Histórico de posiciones</h2>
      {history.length < 2 ? (
        <p className="empty">Aparecerá en cuanto haya al menos dos partidos con resultado.</p>
      ) : (
        <HistoryChart history={history} players={players} colorOf={colorOf} me={me} />
      )}
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function Podium({ rows, me }: { rows: Standing[]; me: Player }) {
  // Orden visual: 2.º, 1.º, 3.º
  const order = [rows[1], rows[0], rows[2]]
  return (
    <div className="podium">
      {order.map((r) => (
        <div
          key={r.player.id}
          className={`podium-step place-${r.position} ${r.player.id === me.id ? 'me' : ''}`}
        >
          <div className="podium-medal">{MEDALS[r.position - 1] ?? r.position}</div>
          <div className="podium-emoji">{r.player.emoji || '👤'}</div>
          <div className="podium-name">{r.player.name}</div>
          <div className="podium-pts">
            {r.points} <span>pts</span>
          </div>
          <div className="podium-block">{r.position}</div>
        </div>
      ))}
    </div>
  )
}

function HistoryChart({
  history, players, colorOf, me,
}: {
  history: HistoryStep[]
  players: Player[]
  colorOf: Map<number, string>
  me: Player
}) {
  const { team } = useData()
  const [focus, setFocus] = useState<number | null>(me.id)
  const n = players.length
  const W = 360
  const rowH = 26
  const pad = { top: 14, right: 14, bottom: 26, left: 30 }
  const H = pad.top + pad.bottom + Math.max(1, n - 1) * rowH
  const steps = history.length
  const x = (i: number) => pad.left + (i / (steps - 1)) * (W - pad.left - pad.right)
  const y = (pos: number) => pad.top + (pos - 1) * rowH

  // Separadores de jornada: primer partido de cada día
  const dayStarts = history
    .map((s, i) => ({ i, day: madridDay(s.match.start_time) }))
    .filter((d, i, all) => i === 0 || d.day !== all[i - 1].day)

  const ordered = [...players].sort((a, b) => (a.id === focus ? 1 : b.id === focus ? -1 : 0))

  return (
    <div className="card chart-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="history" role="img" aria-label="Evolución del puesto de cada jugador">
        {Array.from({ length: n }, (_, k) => (
          <g key={k}>
            <line x1={pad.left} x2={W - pad.right} y1={y(k + 1)} y2={y(k + 1)} className="grid" />
            <text x={pad.left - 10} y={y(k + 1)} className="axis" textAnchor="end" dominantBaseline="middle">
              {k + 1}
            </text>
          </g>
        ))}
        {dayStarts.slice(1).map((d) => (
          <line key={d.i} x1={x(d.i - 0.5)} x2={x(d.i - 0.5)} y1={pad.top - 6} y2={H - pad.bottom + 6} className="day-sep" />
        ))}
        <text x={pad.left} y={H - 6} className="axis">
          {dayTitle(dayStarts[0].day)}
        </text>
        <text x={W - pad.right} y={H - 6} className="axis" textAnchor="end">
          Partidos jugados: {steps}
        </text>

        {ordered.map((p) => {
          const pts = history.map((s, i) => `${x(i)},${y(s.positions.get(p.id) ?? n)}`)
          const dim = focus != null && focus !== p.id
          const last = history[steps - 1].positions.get(p.id) ?? n
          return (
            <g key={p.id} className={`series ${dim ? 'dim' : ''}`} onClick={() => setFocus(focus === p.id ? null : p.id)}>
              <polyline
                points={pts.join(' ')}
                fill="none"
                stroke={colorOf.get(p.id)}
                strokeWidth={focus === p.id ? 3.5 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="draw"
              />
              {steps <= 30 &&
                history.map((s, i) => {
                  const A = team(s.match.team_a), B = team(s.match.team_b)
                  return (
                    <circle key={i} cx={x(i)} cy={y(s.positions.get(p.id) ?? n)} r={focus === p.id ? 4 : 2.5} fill={colorOf.get(p.id)}>
                      <title>
                        {p.name}: {s.positions.get(p.id)}.º tras {A?.short} vs {B?.short}
                      </title>
                    </circle>
                  )
                })}
              <circle cx={x(steps - 1)} cy={y(last)} r={5} fill={colorOf.get(p.id)} />
            </g>
          )
        })}
      </svg>
      <div className="legend">
        {players.map((p) => (
          <button
            key={p.id}
            className={`chip ${focus === p.id ? 'active' : ''}`}
            onClick={() => setFocus(focus === p.id ? null : p.id)}
          >
            <span className="dot" style={{ background: colorOf.get(p.id) }} />
            {p.emoji} {p.name}
          </button>
        ))}
      </div>
      <p className="muted small">Toca un jugador para resaltar su línea. Las líneas verticales separan las jornadas.</p>
    </div>
  )
}

function Arrow({ change }: { change: number | null }) {
  if (change == null || change === 0) return null
  return <span className={`arrow ${change > 0 ? 'up' : 'down'}`}>{change > 0 ? `▲${change}` : `▼${-change}`}</span>
}
