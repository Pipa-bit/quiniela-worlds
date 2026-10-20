import { useState } from 'react'
import { rpc, session } from '../lib/api'
import { useData } from '../data'

export default function Login({ onLogin, error }: { onLogin: (playerId: number) => void; error: string | null }) {
  const { players } = useData()
  const [code, setCode] = useState(session.groupCode() ?? '')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function check(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (await rpc<boolean>('check_group_code', { p_code: code.trim() })) setOk(true)
      else setMsg('Código incorrecto')
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="login">
        <div className="hero">🏆</div>
        <h1 className="login-title">
          LMBL Quiniela
          <span>Worlds 2026</span>
        </h1>
        {error && <div className="banner error">{error}</div>}
        {!ok ? (
          <form onSubmit={check} className="stack">
            <label className="muted" htmlFor="code">Código del grupo</label>
            <input
              id="code"
              className="input big"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              autoFocus
            />
            <button className="btn primary big" disabled={busy || !code.trim()}>
              Entrar
            </button>
            {msg && <p className="error-text">{msg}</p>}
          </form>
        ) : (
          <div className="stack">
            <p className="muted">¿Quién eres?</p>
            {players.length === 0 && <p className="muted">Aún no hay jugadores. El admin tiene que darlos de alta.</p>}
            <div className="player-grid">
              {players.map((p) => (
                <button
                  key={p.id}
                  className="btn big"
                  style={p.color ? { borderColor: p.color } : undefined}
                  onClick={() => {
                    session.login(code.trim(), p.id)
                    onLogin(p.id)
                  }}
                >
                  {p.emoji && <span>{p.emoji}</span>} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <a className="muted small" href="#/admin">Admin</a>
      </div>
    </div>
  )
}
