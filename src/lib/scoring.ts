// Lógica pura de puntos, clasificación, rachas y tabla suiza.
// Es la misma regla que las vistas SQL (supabase/schema.sql).
import { madridDay } from './time'
import type { Match, Player, Prediction, Team } from './types'

export interface Score {
  a: number
  b: number
}

/** Marcadores finales posibles para un formato, ordenados de "gana A claro" a "gana B claro". */
export function possibleScores(bestOf: number): Score[] {
  const win = (bestOf + 1) / 2
  const out: Score[] = []
  for (let l = 0; l < win; l++) out.push({ a: win, b: l })
  for (let l = win - 1; l >= 0; l--) out.push({ a: l, b: win })
  return out
}

export function isValidScore(bestOf: number, a: number, b: number): boolean {
  return possibleScores(bestOf).some((s) => s.a === a && s.b === b)
}

/** 'a' | 'b' según quién gana ese marcador. */
export function winnerOf(a: number, b: number): 'a' | 'b' {
  return a > b ? 'a' : 'b'
}

export interface PredictionResult {
  winner: boolean
  exact: boolean
  points: number
}

/** null si el partido no tiene resultado todavía. */
export function scorePrediction(
  match: Pick<Match, 'best_of' | 'score_a' | 'score_b'>,
  pred: Pick<Prediction, 'score_a' | 'score_b'>,
): PredictionResult | null {
  if (match.score_a == null || match.score_b == null) return null
  const winner = winnerOf(pred.score_a, pred.score_b) === winnerOf(match.score_a, match.score_b)
  const exact = match.best_of > 1 && pred.score_a === match.score_a && pred.score_b === match.score_b
  return { winner, exact, points: (winner ? 1 : 0) + (exact ? 1 : 0) }
}

export interface Standing {
  player: Player
  points: number
  exacts: number
  winners: number
  played: number
  position: number
  /** Puestos ganados (+) o perdidos (−) respecto a la jornada anterior; null si no hay jornada anterior. */
  change: number | null
}

/** Desempate: puntos, exactos, aciertos de ganador y, por último, orden alfabético. */
export function compareStandings(
  x: Pick<Standing, 'points' | 'exacts' | 'winners' | 'player'>,
  y: Pick<Standing, 'points' | 'exacts' | 'winners' | 'player'>,
): number {
  return (
    y.points - x.points ||
    y.exacts - x.exacts ||
    y.winners - x.winners ||
    x.player.name.localeCompare(y.player.name, 'es')
  )
}

function rank(players: Player[], matches: Match[], predictions: Prediction[]): Omit<Standing, 'change'>[] {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const rows = players.map((player) => ({ player, points: 0, exacts: 0, winners: 0, played: 0, position: 0 }))
  const rowOf = new Map(rows.map((r) => [r.player.id, r]))
  for (const p of predictions) {
    const m = byId.get(p.match_id)
    const row = rowOf.get(p.player_id)
    if (!m || !row) continue
    const r = scorePrediction(m, p)
    if (!r) continue
    row.played++
    row.points += r.points
    if (r.exact) row.exacts++
    if (r.winner) row.winners++
  }
  rows.sort(compareStandings)
  // Empate total (puntos, exactos y ganadores) = mismo puesto; el alfabético solo ordena la lista
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.position =
      prev && prev.points === r.points && prev.exacts === r.exacts && prev.winners === r.winners ? prev.position : i + 1
  })
  return rows
}

/**
 * Clasificación actual con flechas: la "jornada" es el día (hora de Madrid) de los partidos.
 * El cambio compara con la clasificación sin contar el último día que tiene resultados.
 */
export function buildLeaderboard(players: Player[], matches: Match[], predictions: Prediction[]): Standing[] {
  const finished = matches.filter((m) => m.score_a != null)
  const days = [...new Set(finished.map((m) => madridDay(m.start_time)))].sort()
  const current = rank(players, finished, predictions)
  if (days.length < 2) return current.map((r) => ({ ...r, change: null }))
  const lastDay = days[days.length - 1]
  const before = rank(
    players,
    finished.filter((m) => madridDay(m.start_time) !== lastDay),
    predictions,
  )
  const prevPos = new Map(before.map((r) => [r.player.id, r.position]))
  return current.map((r) => ({ ...r, change: (prevPos.get(r.player.id) ?? r.position) - r.position }))
}

export interface HistoryStep {
  match: Match
  /** Puesto de cada jugador (por id) justo después de este partido. */
  positions: Map<number, number>
}

/** Evolución de la clasificación: el puesto de cada jugador tras cada partido con resultado, en orden cronológico. */
export function positionHistory(players: Player[], matches: Match[], predictions: Prediction[]): HistoryStep[] {
  const finished = matches
    .filter((m) => m.score_a != null && m.score_b != null)
    .sort((x, y) => Date.parse(x.start_time) - Date.parse(y.start_time) || x.id - y.id)
  return finished.map((match, i) => ({
    match,
    positions: new Map(rank(players, finished.slice(0, i + 1), predictions).map((r) => [r.player.id, r.position])),
  }))
}

export interface PlayerStats {
  player: Player
  played: number
  winners: number
  exacts: number
  hitRate: number
  swissHitRate: number | null
  playoffHitRate: number | null
  currentStreak: number
  bestStreak: number
  /** Aciertos de ganador cuando la mayoría falló. */
  contrarian: number
}

export function buildStats(players: Player[], matches: Match[], predictions: Prediction[]): PlayerStats[] {
  const finished = matches
    .filter((m) => m.score_a != null)
    .sort((x, y) => x.start_time.localeCompare(y.start_time) || x.id - y.id)
  const predsByMatch = new Map<number, Prediction[]>()
  for (const p of predictions) {
    const list = predsByMatch.get(p.match_id) ?? []
    list.push(p)
    predsByMatch.set(p.match_id, list)
  }
  return players.map((player) => {
    let played = 0, winners = 0, exacts = 0, streak = 0, best = 0, contrarian = 0
    const phase = { swiss: [0, 0], playoff: [0, 0] }
    for (const m of finished) {
      const preds = predsByMatch.get(m.id) ?? []
      const mine = preds.find((p) => p.player_id === player.id)
      if (!mine) continue
      const r = scorePrediction(m, mine)!
      played++
      const bucket = m.stage === 'swiss' ? phase.swiss : phase.playoff
      bucket[0]++
      if (r.winner) {
        winners++
        bucket[1]++
        streak++
        best = Math.max(best, streak)
        const hits = preds.filter((p) => scorePrediction(m, p)!.winner).length
        if (hits * 2 < preds.length) contrarian++
      } else {
        streak = 0
      }
      if (r.exact) exacts++
    }
    const rate = ([n, ok]: number[]) => (n ? ok / n : null)
    return {
      player,
      played,
      winners,
      exacts,
      hitRate: played ? winners / played : 0,
      swissHitRate: rate(phase.swiss),
      playoffHitRate: rate(phase.playoff),
      currentStreak: streak,
      bestStreak: best,
      contrarian,
    }
  })
}

export interface SwissRow {
  team: Team
  wins: number
  losses: number
  status: 'qualified' | 'eliminated' | 'alive'
}

/** Récord V-D de la fase suiza a partir de los resultados. */
export function swissStandings(teams: Team[], matches: Match[]): SwissRow[] {
  const swiss = matches.filter((m) => m.stage === 'swiss')
  const inSwiss = new Set(swiss.flatMap((m) => [m.team_a, m.team_b]))
  const rows = new Map<number, SwissRow>()
  for (const team of teams) {
    if (inSwiss.has(team.id)) rows.set(team.id, { team, wins: 0, losses: 0, status: 'alive' })
  }
  for (const m of swiss) {
    if (m.score_a == null || m.score_b == null) continue
    const [w, l] = m.score_a > m.score_b ? [m.team_a, m.team_b] : [m.team_b, m.team_a]
    const rw = rows.get(w), rl = rows.get(l)
    if (rw) rw.wins++
    if (rl) rl.losses++
  }
  for (const r of rows.values()) r.status = r.wins >= 3 ? 'qualified' : r.losses >= 3 ? 'eliminated' : 'alive'
  return [...rows.values()].sort(
    (x, y) => y.wins - y.losses - (x.wins - x.losses) || y.wins - x.wins || x.team.short.localeCompare(y.team.short),
  )
}
