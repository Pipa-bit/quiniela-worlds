import { useState } from 'react'
import TeamLogo from '../components/TeamLogo'
import { useData } from '../data'
import { rpc, session } from '../lib/api'
import { possibleScores } from '../lib/scoring'
import { dayTitle, madridDay, madridInputValue, madridTime } from '../lib/time'
import { matchLabel, type Match, type Player, type Stage, type Team } from '../lib/types'

type Tab = 'resultados' | 'partidos' | 'equipos' | 'jugadores' | 'ajustes'
const TABS: [Tab, string][] = [
  ['resultados', 'Resultados'],
  ['partidos', 'Partidos'],
  ['equipos', 'Equipos'],
  ['jugadores', 'Jugadores'],
  ['ajustes', 'Ajustes'],
]

/** Ejecuta una acción de admin, recarga los datos y avisa si falla. */
function useAdminAction() {
  const { reload } = useData()
  const [busy, setBusy] = useState(false)
  return {
    busy,
    async run(fn: string, args: Record<string, unknown>): Promise<boolean> {
      setBusy(true)
      try {
        await rpc(fn, { p_code: session.adminCode(), ...args })
        await reload()
        return true
      } catch (e) {
        alert((e as Error).message)
        return false
      } finally {
        setBusy(false)
      }
    },
  }
}

export default function Admin() {
  const [code, setCode] = useState(session.adminCode())
  const [tab, setTab] = useState<Tab>('resultados')

  if (!code) return <AdminLogin onOk={setCode} />

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⚙️ Admin</span>
        <a className="link" href="#/">
          Volver a la quiniela
        </a>
      </header>
      <nav className="subtabs">
        {TABS.map(([t, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'resultados' && <Results />}
        {tab === 'partidos' && <MatchesAdmin />}
        {tab === 'equipos' && <TeamsAdmin />}
        {tab === 'jugadores' && <PlayersAdmin />}
        {tab === 'ajustes' && <Settings onLogout={() => setCode(null)} />}
      </main>
    </div>
  )
}

function AdminLogin({ onOk }: { onOk: (code: string) => void }) {
  const [value, setValue] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="center-screen">
      <form
        className="login stack"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            if (await rpc<boolean>('check_admin_code', { p_code: value.trim() })) {
              session.setAdmin(value.trim())
              onOk(value.trim())
            } else setMsg('Código de admin incorrecto')
          } catch (err) {
            setMsg((err as Error).message)
          }
        }}
      >
        <h1>Admin</h1>
        <input
          className="input big"
          type="password"
          placeholder="Código de admin"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button className="btn primary big">Entrar</button>
        {msg && <p className="error-text">{msg}</p>}
        <a className="muted small" href="#/">
          Volver
        </a>
      </form>
    </div>
  )
}

// ───────────────────────── Resultados ─────────────────────────

function Results() {
  const { matches } = useData()
  const now = Date.now()
  const pending = matches.filter((m) => m.score_a == null)
  const done = matches.filter((m) => m.score_a != null).reverse()
  // Primero los que ya han empezado y no tienen resultado
  pending.sort((x, y) => {
    const sx = Date.parse(x.start_time) <= now ? 0 : 1
    const sy = Date.parse(y.start_time) <= now ? 0 : 1
    return sx - sy || x.start_time.localeCompare(y.start_time)
  })
  if (matches.length === 0) return <p className="empty">Crea partidos en la pestaña Partidos.</p>
  return (
    <div className="stack">
      <h2 className="section">Sin resultado</h2>
      {pending.length === 0 && <p className="muted">Nada pendiente.</p>}
      {pending.map((m) => (
        <ResultCard key={m.id} m={m} />
      ))}
      <h2 className="section">Con resultado</h2>
      {done.map((m) => (
        <ResultCard key={m.id} m={m} />
      ))}
    </div>
  )
}

function ResultCard({ m }: { m: Match }) {
  const { team } = useData()
  const { busy, run } = useAdminAction()
  const A = team(m.team_a), B = team(m.team_b)
  const started = Date.parse(m.start_time) <= Date.now()
  return (
    <article className="match compact">
      <div className="match-head">
        <span>
          {matchLabel(m)} · Bo{m.best_of}
        </span>
        <span>
          {dayTitle(madridDay(m.start_time))} {madridTime(m.start_time)} {started ? '' : '· no ha empezado'}
        </span>
      </div>
      <div className="teams small-teams">
        <div className="team">
          <TeamLogo team={A} size={28} /> {A?.short}
        </div>
        <div className="score">{m.score_a != null ? `${m.score_a} - ${m.score_b}` : 'vs'}</div>
        <div className="team">
          <TeamLogo team={B} size={28} /> {B?.short}
        </div>
      </div>
      <div className="pick-row wrap">
        {possibleScores(m.best_of).map((s) => (
          <button
            key={`${s.a}-${s.b}`}
            disabled={busy}
            className={`btn pick ${m.score_a === s.a && m.score_b === s.b ? 'selected' : ''}`}
            onClick={() => run('admin_set_result', { p_id: m.id, p_score_a: s.a, p_score_b: s.b })}
          >
            {m.best_of === 1 ? `Gana ${(s.a > s.b ? A : B)?.short}` : `${s.a}-${s.b}`}
          </button>
        ))}
      </div>
      <div className="row-actions">
        <button className="btn small" disabled={busy} onClick={() => run('admin_set_locked', { p_id: m.id, p_locked: !m.locked })}>
          {m.locked ? '🔓 Desbloquear' : '🔒 Bloquear'}
        </button>
        {m.score_a != null && (
          <button
            className="btn small danger"
            disabled={busy}
            onClick={() => confirm('¿Borrar el resultado?') && run('admin_set_result', { p_id: m.id, p_score_a: null, p_score_b: null })}
          >
            Borrar resultado
          </button>
        )}
      </div>
    </article>
  )
}

// ───────────────────────── Partidos ─────────────────────────

interface MatchForm {
  id: number | null
  stage: Stage
  round: number
  team_a: number | ''
  team_b: number | ''
  best_of: 1 | 3 | 5
  start: string
}

const emptyMatch = (prev?: MatchForm): MatchForm => ({
  id: null,
  stage: prev?.stage ?? 'swiss',
  round: prev?.round ?? 1,
  team_a: '',
  team_b: '',
  best_of: prev?.best_of ?? 1,
  start: prev?.start ?? '',
})

function MatchesAdmin() {
  const { matches, teams, team } = useData()
  const { busy, run } = useAdminAction()
  const [f, setF] = useState<MatchForm>(emptyMatch())

  const edit = (m: Match) => {
    setF({
      id: m.id,
      stage: m.stage,
      round: m.round ?? 1,
      team_a: m.team_a,
      team_b: m.team_b,
      best_of: m.best_of,
      start: madridInputValue(m.start_time),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.team_a || !f.team_b || f.team_a === f.team_b) return alert('Elige dos equipos distintos')
    if (!f.start) return alert('Pon fecha y hora')
    const ok = await run('admin_save_match', {
      p_id: f.id,
      p_stage: f.stage,
      p_round: f.stage === 'swiss' ? f.round : null,
      p_team_a: f.team_a,
      p_team_b: f.team_b,
      p_best_of: f.best_of,
      p_start_local: f.start.replace('T', ' '),
    })
    if (ok) setF(emptyMatch(f))
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={save}>
        <h2 className="section">{f.id ? 'Editar partido' : 'Nuevo partido'}</h2>
        <div className="grid2">
          <label>
            Fase
            <select
              className="input"
              value={f.stage}
              onChange={(e) => {
                const stage = e.target.value as Stage
                setF({ ...f, stage, best_of: stage === 'swiss' ? f.best_of : 5 })
              }}
            >
              <option value="swiss">Suiza</option>
              <option value="qf">Cuartos</option>
              <option value="sf">Semis</option>
              <option value="final">Final</option>
            </select>
          </label>
          {f.stage === 'swiss' ? (
            <label>
              Ronda
              <select className="input" value={f.round} onChange={(e) => setF({ ...f, round: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    Ronda {r}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span />
          )}
          <label>
            Equipo A
            <TeamSelect teams={teams} value={f.team_a} onChange={(v) => setF({ ...f, team_a: v })} />
          </label>
          <label>
            Equipo B
            <TeamSelect teams={teams} value={f.team_b} onChange={(v) => setF({ ...f, team_b: v })} />
          </label>
        </div>
        <div className="seg">
          {([1, 3, 5] as const).map((b) => (
            <button type="button" key={b} className={f.best_of === b ? 'active' : ''} onClick={() => setF({ ...f, best_of: b })}>
              Bo{b}
            </button>
          ))}
        </div>
        <label>
          Fecha y hora (Madrid)
          <input className="input" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </label>
        <div className="row-actions">
          <button className="btn primary" disabled={busy}>
            {f.id ? 'Guardar cambios' : 'Crear partido'}
          </button>
          {f.id && (
            <button type="button" className="btn" onClick={() => setF(emptyMatch(f))}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {[...matches].reverse().map((m) => (
        <div key={m.id} className="list-row">
          <div>
            <b>
              {team(m.team_a)?.short} vs {team(m.team_b)?.short}
            </b>{' '}
            <span className="muted small">
              {matchLabel(m)} · Bo{m.best_of} · {madridDay(m.start_time).slice(5)} {madridTime(m.start_time)}
              {m.locked && ' · 🔒'}
            </span>
          </div>
          <div className="row-actions">
            <button className="btn small" onClick={() => edit(m)}>
              Editar
            </button>
            <button
              className="btn small danger"
              disabled={busy}
              onClick={() => confirm('¿Borrar el partido y sus predicciones?') && run('admin_delete_match', { p_id: m.id })}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TeamSelect({ teams, value, onChange }: { teams: Team[]; value: number | ''; onChange: (v: number | '') => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
      <option value="">—</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.short} · {t.name}
        </option>
      ))}
    </select>
  )
}

// ───────────────────────── Equipos ─────────────────────────

function TeamsAdmin() {
  const { teams } = useData()
  const { busy, run } = useAdminAction()
  const blank = { id: null as number | null, name: '', short: '', region: '', logo_url: '' }
  const [f, setF] = useState(blank)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim() || !f.short.trim()) return alert('Nombre y siglas son obligatorios')
    const ok = await run('admin_save_team', {
      p_id: f.id,
      p_name: f.name.trim(),
      p_short: f.short.trim(),
      p_region: f.region.trim(),
      p_logo_url: f.logo_url.trim(),
    })
    if (ok) setF(blank)
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={save}>
        <h2 className="section">{f.id ? 'Editar equipo' : 'Nuevo equipo'}</h2>
        <div className="grid2">
          <input className="input" placeholder="Nombre (Gen.G)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Siglas (GEN)" value={f.short} onChange={(e) => setF({ ...f, short: e.target.value })} />
          <input className="input" placeholder="Región (LCK)" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
          <input
            className="input"
            placeholder="Logo: URL o logos/gen.png"
            value={f.logo_url}
            onChange={(e) => setF({ ...f, logo_url: e.target.value })}
          />
        </div>
        <div className="row-actions">
          <button className="btn primary" disabled={busy}>
            {f.id ? 'Guardar' : 'Añadir equipo'}
          </button>
          {f.id && (
            <button type="button" className="btn" onClick={() => setF(blank)}>
              Cancelar
            </button>
          )}
        </div>
      </form>
      {teams.map((t) => (
        <div key={t.id} className="list-row">
          <div className="team-cell">
            <TeamLogo team={t} size={28} /> <b>{t.short}</b> <span className="muted small">{t.name} · {t.region}</span>
          </div>
          <div className="row-actions">
            <button className="btn small" onClick={() => setF({ ...t })}>
              Editar
            </button>
            <button
              className="btn small danger"
              disabled={busy}
              onClick={() => confirm(`¿Borrar ${t.short}?`) && run('admin_delete_team', { p_id: t.id })}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────── Jugadores ─────────────────────────

function PlayersAdmin() {
  const { players } = useData()
  const { busy, run } = useAdminAction()
  const blank = { id: null as number | null, name: '', emoji: '', color: '' }
  const [f, setF] = useState(blank)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) return alert('Pon un nombre')
    const ok = await run('admin_save_player', { p_id: f.id, p_name: f.name.trim(), p_emoji: f.emoji.trim(), p_color: f.color })
    if (ok) setF(blank)
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={save}>
        <h2 className="section">{f.id ? 'Editar jugador' : 'Nuevo jugador'}</h2>
        <div className="grid2">
          <input className="input" placeholder="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Emoji (opcional)" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
        </div>
        <label className="inline">
          Color (opcional)
          <input type="color" value={f.color || '#7c5cff'} onChange={(e) => setF({ ...f, color: e.target.value })} />
          {f.color && (
            <button type="button" className="btn small" onClick={() => setF({ ...f, color: '' })}>
              Quitar
            </button>
          )}
        </label>
        <div className="row-actions">
          <button className="btn primary" disabled={busy}>
            {f.id ? 'Guardar' : 'Añadir jugador'}
          </button>
          {f.id && (
            <button type="button" className="btn" onClick={() => setF(blank)}>
              Cancelar
            </button>
          )}
        </div>
      </form>
      {players.map((p: Player) => (
        <div key={p.id} className="list-row" style={p.color ? { borderLeft: `4px solid ${p.color}` } : undefined}>
          <div>
            {p.emoji} <b>{p.name}</b>
          </div>
          <div className="row-actions">
            <button className="btn small" onClick={() => setF({ ...p })}>
              Editar
            </button>
            <button
              className="btn small danger"
              disabled={busy}
              onClick={() => confirm(`¿Borrar a ${p.name} y todas sus predicciones?`) && run('admin_delete_player', { p_id: p.id })}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────── Ajustes ─────────────────────────

function Settings({ onLogout }: { onLogout: () => void }) {
  const { busy, run } = useAdminAction()
  const [group, setGroup] = useState('')
  const [admin, setAdmin] = useState('')
  return (
    <div className="stack">
      <form
        className="card stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!group.trim() || !admin.trim()) return alert('Rellena los dos códigos')
          if (await run('admin_set_codes', { p_group_code: group, p_admin_code: admin })) {
            session.setAdmin(admin.trim())
            alert('Códigos cambiados. Pasa el nuevo código del grupo a los demás.')
            setGroup('')
            setAdmin('')
          }
        }}
      >
        <h2 className="section">Cambiar códigos</h2>
        <input className="input" placeholder="Nuevo código del grupo" value={group} onChange={(e) => setGroup(e.target.value)} />
        <input className="input" placeholder="Nuevo código de admin" value={admin} onChange={(e) => setAdmin(e.target.value)} />
        <button className="btn primary" disabled={busy}>
          Guardar códigos
        </button>
      </form>
      <button
        className="btn"
        onClick={() => {
          session.setAdmin(null)
          onLogout()
        }}
      >
        Salir del admin
      </button>
    </div>
  )
}
