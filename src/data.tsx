import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadAll, type AllData } from './lib/api'
import type { Team } from './lib/types'

interface DataCtx extends AllData {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  team: (id: number) => Team | undefined
}

const Ctx = createContext<DataCtx | null>(null)
const EMPTY: AllData = { teams: [], players: [], matches: [], predictions: [] }

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AllData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await loadAll())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial, cada 30 s y al volver a la pestaña
  useEffect(() => {
    reload()
    const t = setInterval(() => document.visibilityState === 'visible' && reload(), 30_000)
    const onVis = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reload])

  const teamMap = useMemo(() => new Map(data.teams.map((t) => [t.id, t])), [data.teams])
  const value = useMemo(
    () => ({ ...data, loading, error, reload, team: (id: number) => teamMap.get(id) }),
    [data, loading, error, reload, teamMap],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData fuera de DataProvider')
  return v
}

/** Reloj que avanza cada segundo (para cuentas atrás y cierres). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Ruta actual a partir del hash: '#/admin' → '/admin'. */
export function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
