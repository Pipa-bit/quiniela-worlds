import { useMemo, useState } from 'react'
import TeamLogo from '../components/TeamLogo'
import { useData, useNow } from '../data'
import { rpc, session } from '../lib/api'
import { possibleScores, scorePrediction, winnerOf } from '../lib/scoring'
import { countdown, dayTitle, madridDay, madridTime } from '../lib/time'
import { matchLabel, type Match, type Player, type Prediction, type Team } from '../lib/types'

export function isOpen(m: Match, now: number): boolean {
  return !m.locked && m.score_a == null && now < Date.parse(m.start_time)
}

/** 'GEN' en Bo1, 'GEN 2-1' en Bo3/Bo5 (marcador del ganador primero). */
export function pickText(m: Match, a: number, b: number, team: (id: number) => Team | undefined): string {
  const w = winnerOf(a, b) === 'a' ? team(m.team_a) : team(m.team_b)
  const name = w?.short ?? '?'
  return m.best_of === 1 ? name : `${name} ${Math.max(a, b)}-${Math.min(a, b)}`
}

function groupByDay(list: Match[]): [string, Match[]][] {
  const map = new Map<string, Match[]>()
  for (const m of list) {
    const d = madridDay(m.start_time)
    map.set(d, [...(map.get(d) ?? []), m])
  }
  return [...map.entries()]
}

export default function Matches({ me }: { me: Player }) {
  const { matches, predictions } = useData()
  const now = useNow()
  const [showAllClosed, setShowAllClosed] = useState(false)

  const mine = useMemo(
    () => new Map(predictions.filter((p) => p.player_id === me.id).map((p) => [p.match_id, p])),
    [predictions, me.id],
  )
  const open = matches.filter((m) => isOpen(m, now))
  const closed = matches.filter((m) => !isOpen(m, now)).reverse()
  const missing = open.filter((m) => !mine.has(m.id)).length
  const closedShown = showAllClosed ? closed : closed.slice(0, 12)

  if (matches.length === 0) return <p className="empty">Todavía no hay partidos. ¡Vuelve pronto!</p>

  return (
    <div className="stack">
      {open.length > 0 && (
        <div className={`banner ${missing ? 'warn' : 'ok'}`}>
          {missing ? `Te faltan ${missing} ${missing === 1 ? 'partido' : 'partidos'} por predecir` : '✅ Lo tienes todo predicho'}
        </div>
      )}

      {open.length > 0 && <h2 className="section">Próximos</h2>}
      {groupByDay(open).map(([day, list]) => (
        <section key={day} className="stack">
          <h3 className="day">{dayTitle(day)}</h3>
          {list.map((m) => (
            <MatchCard key={m.id} match={m} me={me} now={now} />
          ))}
        </section>
      ))}

      {closed.length > 0 && <h2 className="section">Cerrados y resultados</h2>}
      {groupByDay(closedShown).map(([day, list]) => (
        <section key={day} className="stack">
          <h3 className="day">{dayTitle(day)}</h3>
          {list.map((m) => (
            <MatchCard key={m.id} match={m} me={me} now={now} />
          ))}
        </section>
      ))}
      {closed.length > closedShown.length && (
        <button className="btn" onClick={() => setShowAllClosed(true)}>
          Ver todos ({closed.length})
        </button>
      )}
    </div>
  )
}

function MatchCard({ match: m, me, now }: { match: Match; me: Player; now: number }) {
  const { team, players, predictions, reload } = useData()
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<{ a: number; b: number } | null>(null)

  const A = team(m.team_a), B = team(m.team_b)
  const preds = predictions.filter((p) => p.match_id === m.id)
  const saved = preds.find((p) => p.player_id === me.id)
  const myPick = optimistic ?? (saved ? { a: saved.score_a, b: saved.score_b } : null)
  const open = isOpen(m, now)
  const hasResult = m.score_a != null && m.score_b != null
  const msLeft = Date.parse(m.start_time) - now

  async function choose(a: number, b: number) {
    setOptimistic({ a, b })
    setSaving(`${a}-${b}`)
    setErr(null)
    try {
      await rpc('predict', { p_code: session.groupCode(), p_player: me.id, p_match: m.id, p_score_a: a, p_score_b: b })
      await reload()
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('Código de grupo')) {
        // El admin ha cambiado el código: hay que volver a entrar
        alert('El código del grupo ha cambiado. Vuelve a entrar.')
        session.logout()
        location.reload()
      }
      setErr(msg)
    } finally {
      setOptimistic(null)
      setSaving(null)
    }
  }

  const status = hasResult
    ? 'Final'
    : open
      ? `Cierra en ${countdown(msLeft)}`
      : m.locked && msLeft > 0
        ? '🔒 Bloqueado'
        : 'En juego / cerrado'

  const scores = possibleScores(m.best_of)
  const half = scores.length / 2

  const wonA = hasResult && m.score_a! > m.score_b!
  const wonB = hasResult && m.score_b! > m.score_a!
  const myResult = saved && hasResult ? scorePrediction(m, saved) : null
  const urgent = open && msLeft < 60 * 60 * 1000

  return (
    <article className={`match fade-in ${open && !saved ? 'missing' : ''} ${hasResult ? 'finished' : ''}`}>
      <div className="match-head">
        <span className="tags">
          <span className="tag">{matchLabel(m)}</span>
          <span className="tag bo">Bo{m.best_of}</span>
        </span>
        <span>
          {madridTime(m.start_time)} · <b className={`${open ? 'accent' : ''} ${urgent ? 'urgent' : ''}`}>{status}</b>
        </span>
      </div>

      <div className="teams">
        <div className={`team ${wonA ? 'won' : ''} ${wonB ? 'lost' : ''}`}>
          <TeamLogo team={A} size={56} />
          <span className="team-short">{A?.short}</span>
          {A && A.name !== A.short && <span className="team-name">{A.name}</span>}
        </div>
        {hasResult ? (
          <div className="score">
            <span className={wonA ? 'win' : ''}>{m.score_a}</span>
            <span className="score-sep">:</span>
            <span className={wonB ? 'win' : ''}>{m.score_b}</span>
          </div>
        ) : (
          <div className="vs">VS</div>
        )}
        <div className={`team ${wonB ? 'won' : ''} ${wonA ? 'lost' : ''}`}>
          <TeamLogo team={B} size={56} />
          <span className="team-short">{B?.short}</span>
          {B && B.name !== B.short && <span className="team-name">{B.name}</span>}
        </div>
      </div>

      {myResult && saved && (
        <div className={`my-result ${myResult.points ? 'good' : 'bad'}`}>
          <span>Tu predicción: {pickText(m, saved.score_a, saved.score_b, team)}</span>
          <b>{myResult.exact ? '🎯 Exacto' : myResult.winner ? '✓ Acierto' : '✗ Fallo'} · +{myResult.points}</b>
        </div>
      )}

      {open ? (
        m.best_of === 1 ? (
          <div className="pick-row two">
            {scores.map((s) => (
              <PickButton key={`${s.a}-${s.b}`} s={s} pick={myPick} saving={saving} onPick={choose}>
                Gana {(s.a > s.b ? A : B)?.short}
              </PickButton>
            ))}
          </div>
        ) : (
          <div className="pick-cols">
            {[scores.slice(0, half), scores.slice(half)].map((col, i) => (
              <div key={i} className="pick-col">
                <span className="small muted center">Gana {(i === 0 ? A : B)?.short}</span>
                {col.map((s) => (
                  <PickButton key={`${s.a}-${s.b}`} s={s} pick={myPick} saving={saving} onPick={choose}>
                    {s.a}-{s.b}
                  </PickButton>
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        !saved && !hasResult && <p className="muted small center">No predijiste este partido</p>
      )}
      {err && <p className="error-text">{err}</p>}

      <Others match={m} preds={preds} players={players} me={me} />
    </article>
  )
}

function PickButton({
  s, pick, saving, onPick, children,
}: {
  s: { a: number; b: number }
  pick: { a: number; b: number } | null
  saving: string | null
  onPick: (a: number, b: number) => void
  children: React.ReactNode
}) {
  const selected = pick?.a === s.a && pick?.b === s.b
  return (
    <button
      className={`btn pick ${selected ? 'selected' : ''}`}
      disabled={saving != null}
      onClick={() => onPick(s.a, s.b)}
    >
      {children}
    </button>
  )
}

function Others({ match: m, preds, players, me }: { match: Match; preds: Prediction[]; players: Player[]; me: Player }) {
  const { team } = useData()
  if (preds.length === 0) return null
  const A = team(m.team_a), B = team(m.team_b)
  const withA = preds.filter((p) => p.score_a > p.score_b).length
  const withB = preds.length - withA
  const parts = [
    withA && `${withA} ${withA === 1 ? 'va' : 'van'} con ${A?.short}`,
    withB && `${withB} con ${B?.short}`,
  ].filter(Boolean)
  const byName = [...preds].sort((x, y) => {
    const px = players.find((p) => p.id === x.player_id)?.name ?? ''
    const py = players.find((p) => p.id === y.player_id)?.name ?? ''
    return px.localeCompare(py, 'es')
  })

  return (
    <div className="others">
      <div className="split">
        <div className="split-bar">
          <span style={{ flex: withA }} className="a" />
          <span style={{ flex: withB }} className="b" />
        </div>
        <span className="small muted">{parts.join(', ')}</span>
      </div>
      <ul>
        {byName.map((p) => {
          const pl = players.find((x) => x.id === p.player_id)
          const r = scorePrediction(m, p)
          return (
            <li key={p.player_id} className={p.player_id === me.id ? 'me' : ''}>
              <span>
                {pl?.emoji} {pl?.name}
              </span>
              <span className="pick-text">
                {pickText(m, p.score_a, p.score_b, team)}
                {r && <b className={`pts ${r.points ? 'good' : 'bad'}`}>{r.points ? `+${r.points}` : '0'}</b>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
