import { useState } from 'react'
import { configured, session } from './lib/api'
import { DataProvider, useData, useRoute } from './data'
import Login from './pages/Login'
import Matches from './pages/Matches'
import Leaderboard from './pages/Leaderboard'
import Stats from './pages/Stats'
import Tournament from './pages/Tournament'
import Admin from './pages/Admin'

const TABS = [
  { path: '/', label: 'Partidos', icon: '🎯' },
  { path: '/clasificacion', label: 'Clasificación', icon: '🏆' },
  { path: '/estadisticas', label: 'Stats', icon: '📊' },
  { path: '/torneo', label: 'Torneo', icon: '🗂️' },
]

export default function App() {
  if (!configured) {
    return (
      <div className="center-screen">
        <div className="card">
          <h1>Falta configurar Supabase</h1>
          <p className="muted">
            Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (en local en un fichero{' '}
            <code>.env</code>, en GitHub como secrets). Mira el README.
          </p>
        </div>
      </div>
    )
  }
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}

function Shell() {
  const route = useRoute()
  const { players, loading, error } = useData()
  const [playerId, setPlayerId] = useState(session.playerId())
  const me = players.find((p) => p.id === playerId)

  if (route.startsWith('/admin')) return <Admin />
  if (loading) return <div className="center-screen muted">Cargando…</div>
  if (!me || !session.groupCode()) {
    return <Login onLogin={(id) => setPlayerId(id)} error={error} />
  }

  const page =
    route === '/clasificacion' ? <Leaderboard me={me} /> :
    route === '/estadisticas' ? <Stats /> :
    route === '/torneo' ? <Tournament /> :
    <Matches me={me} />

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Quiniela Worlds 2026</span>
        <button
          className="link"
          onClick={() => {
            if (confirm(`¿Salir como ${me.name}?`)) {
              session.logout()
              setPlayerId(null)
            }
          }}
        >
          {me.emoji || '👤'} {me.name}
        </button>
      </header>
      {error && <div className="banner error">No se pudo actualizar: {error}</div>}
      <main>{page}</main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={route === t.path ? 'active' : ''}>
            <span>{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
