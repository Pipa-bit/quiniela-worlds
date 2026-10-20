import { createClient } from '@supabase/supabase-js'
import type { Match, Player, Prediction, Team } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)
export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: false },
})

export interface AllData {
  teams: Team[]
  players: Player[]
  matches: Match[]
  predictions: Prediction[]
}

export async function loadAll(): Promise<AllData> {
  const [teams, players, matches, predictions] = await Promise.all([
    supabase.from('teams').select('*').order('short'),
    supabase.from('players').select('*').order('name'),
    supabase.from('matches').select('*').order('start_time').order('id'),
    supabase.from('predictions').select('*'),
  ])
  for (const r of [teams, players, matches, predictions]) if (r.error) throw new Error(r.error.message)
  return {
    teams: teams.data as Team[],
    players: players.data as Player[],
    matches: matches.data as Match[],
    predictions: predictions.data as Prediction[],
  }
}

/** Llama a una función RPC y lanza un Error con el mensaje de la base de datos si falla. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

// Sesión guardada en el navegador
const K = { group: 'qw.group', player: 'qw.player', admin: 'qw.admin' }

function get(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function set(k: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento: se pedirá de nuevo */
  }
}

export const session = {
  groupCode: () => get(K.group),
  playerId: () => (get(K.player) ? Number(get(K.player)) : null),
  adminCode: () => get(K.admin),
  login(groupCode: string, playerId: number) {
    set(K.group, groupCode)
    set(K.player, String(playerId))
  },
  logout() {
    set(K.group, null)
    set(K.player, null)
  },
  setAdmin(code: string | null) {
    set(K.admin, code)
  },
}

export function logoSrc(logo: string): string {
  if (!logo) return ''
  return /^(https?:|data:)/.test(logo) ? logo : import.meta.env.BASE_URL + logo.replace(/^\//, '')
}
