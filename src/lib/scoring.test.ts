import { describe, expect, it } from 'vitest'
import {
  arrangeBracket,
  buildLeaderboard,
  buildStats,
  positionHistory,
  isValidScore,
  possibleScores,
  scorePrediction,
  swissStandings,
} from './scoring'
import { countdown, madridDay, madridInputValue, madridTime } from './time'
import type { Match, Player, Prediction, Team } from './types'

let nextId = 1
function match(over: Partial<Match>): Match {
  return {
    id: nextId++,
    stage: 'swiss',
    round: 1,
    team_a: 1,
    team_b: 2,
    best_of: 1,
    start_time: '2026-10-23T16:00:00Z',
    locked: false,
    score_a: null,
    score_b: null,
    ...over,
  }
}
const pred = (player_id: number, m: Match, score_a: number, score_b: number): Prediction => ({
  player_id,
  match_id: m.id,
  score_a,
  score_b,
  updated_at: '',
})
const player = (id: number, name: string): Player => ({ id, name, emoji: '', color: '' })

describe('marcadores', () => {
  it('lista los marcadores posibles de cada formato', () => {
    expect(possibleScores(1)).toEqual([{ a: 1, b: 0 }, { a: 0, b: 1 }])
    expect(possibleScores(3).map((s) => `${s.a}-${s.b}`)).toEqual(['2-0', '2-1', '1-2', '0-2'])
    expect(possibleScores(5).map((s) => `${s.a}-${s.b}`)).toEqual(['3-0', '3-1', '3-2', '2-3', '1-3', '0-3'])
  })
  it('valida marcadores', () => {
    expect(isValidScore(1, 1, 0)).toBe(true)
    expect(isValidScore(1, 2, 1)).toBe(false)
    expect(isValidScore(3, 2, 2)).toBe(false)
    expect(isValidScore(5, 3, 2)).toBe(true)
    expect(isValidScore(5, 2, 1)).toBe(false)
  })
})

describe('puntos por partido', () => {
  it('Bo1: 1 punto por el ganador y nunca exacto', () => {
    const m = match({ best_of: 1, score_a: 1, score_b: 0 })
    expect(scorePrediction(m, { score_a: 1, score_b: 0 })).toEqual({ winner: true, exact: false, points: 1 })
    expect(scorePrediction(m, { score_a: 0, score_b: 1 })).toEqual({ winner: false, exact: false, points: 0 })
  })
  it('Bo3: ganador +1 y exacto +1', () => {
    const m = match({ best_of: 3, score_a: 2, score_b: 1 })
    expect(scorePrediction(m, { score_a: 2, score_b: 1 })?.points).toBe(2)
    expect(scorePrediction(m, { score_a: 2, score_b: 0 })?.points).toBe(1)
    expect(scorePrediction(m, { score_a: 1, score_b: 2 })?.points).toBe(0)
  })
  it('Bo5: exacto 3-2', () => {
    const m = match({ best_of: 5, stage: 'final', round: null, score_a: 2, score_b: 3 })
    expect(scorePrediction(m, { score_a: 2, score_b: 3 })).toEqual({ winner: true, exact: true, points: 2 })
    expect(scorePrediction(m, { score_a: 0, score_b: 3 })).toEqual({ winner: true, exact: false, points: 1 })
  })
  it('sin resultado no puntúa', () => {
    expect(scorePrediction(match({}), { score_a: 1, score_b: 0 })).toBeNull()
  })
})

describe('clasificación y desempates', () => {
  const ana = player(1, 'Ana'), bea = player(2, 'Bea'), carlos = player(3, 'Carlos'), dani = player(4, 'Dani')

  it('desempata por exactos, luego ganadores, luego alfabético', () => {
    const bo3 = match({ best_of: 3, score_a: 2, score_b: 0 })
    const bo1a = match({ best_of: 1, score_a: 1, score_b: 0 })
    const bo1b = match({ best_of: 1, score_a: 0, score_b: 1 })
    const preds = [
      // Dani: 2 puntos con un exacto
      pred(4, bo3, 2, 0),
      // Bea: 2 puntos con dos aciertos de ganador (0 exactos)
      pred(2, bo3, 2, 1), pred(2, bo1a, 1, 0),
      // Carlos y Ana: 1 punto, 1 ganador → alfabético
      pred(3, bo1b, 0, 1),
      pred(1, bo1a, 1, 0),
    ]
    const table = buildLeaderboard([ana, bea, carlos, dani], [bo3, bo1a, bo1b], preds)
    expect(table.map((r) => r.player.name)).toEqual(['Dani', 'Bea', 'Ana', 'Carlos'])
    expect(table.map((r) => r.points)).toEqual([2, 2, 1, 1])
    // empate total → mismo puesto
    expect(table.map((r) => r.position)).toEqual([1, 2, 3, 3])
  })

  it('más exactos gana aunque tenga menos aciertos de ganador', () => {
    const bo3 = match({ best_of: 3, score_a: 2, score_b: 1 })
    const bo1 = match({ best_of: 1, score_a: 1, score_b: 0 })
    const bo1b = match({ best_of: 1, score_a: 1, score_b: 0 })
    const preds = [
      pred(1, bo3, 2, 1), pred(1, bo1, 0, 1), // Ana: 2 pts, 1 exacto, 1 ganador
      pred(2, bo3, 2, 0), pred(2, bo1b, 1, 0), // Bea: 2 pts, 0 exactos, 2 ganadores
    ]
    const table = buildLeaderboard([bea, ana], [bo3, bo1, bo1b], preds)
    expect(table.map((r) => r.player.name)).toEqual(['Ana', 'Bea'])
  })

  it('ignora partidos sin resultado y cuenta jugadores sin predicciones', () => {
    const open = match({ best_of: 3 })
    const table = buildLeaderboard([ana, bea], [open], [pred(1, open, 2, 0)])
    expect(table.every((r) => r.points === 0 && r.position === 1)).toBe(true)
  })

  it('flechas respecto a la jornada anterior (día de Madrid)', () => {
    const day1 = match({ start_time: '2026-10-23T18:00:00Z', score_a: 1, score_b: 0 })
    const day2a = match({ start_time: '2026-10-24T18:00:00Z', score_a: 1, score_b: 0 })
    const day2b = match({ start_time: '2026-10-24T20:00:00Z', score_a: 1, score_b: 0 })
    const preds = [pred(1, day1, 1, 0), pred(2, day2a, 1, 0), pred(2, day2b, 1, 0)]
    const table = buildLeaderboard([ana, bea], [day1, day2a, day2b], preds)
    expect(table.map((r) => [r.player.name, r.change])).toEqual([['Bea', 1], ['Ana', -1]])
  })

  it('sin jornada anterior no hay flechas', () => {
    const m = match({ score_a: 1, score_b: 0 })
    expect(buildLeaderboard([ana], [m], [pred(1, m, 1, 0)])[0].change).toBeNull()
  })
})

describe('histórico de posiciones', () => {
  it('da el puesto de cada jugador tras cada partido, en orden cronológico', () => {
    const ana = player(1, 'Ana'), beto = player(2, 'Beto')
    const late = match({ start_time: '2026-10-24T16:00:00Z', score_a: 0, score_b: 1 })
    const early = match({ start_time: '2026-10-23T16:00:00Z', score_a: 1, score_b: 0 })
    const pending = match({ start_time: '2026-10-25T16:00:00Z' })
    const preds = [pred(1, early, 0, 1), pred(2, early, 1, 0), pred(1, late, 0, 1), pred(1, pending, 1, 0)]
    const h = positionHistory([ana, beto], [late, early, pending], preds)
    expect(h.map((s) => s.match.id)).toEqual([early.id, late.id])
    expect(h[0].positions.get(2)).toBe(1)
    expect(h[0].positions.get(1)).toBe(2)
    // Tras el segundo partido empatan a 1 punto y comparten puesto
    expect(h[1].positions.get(1)).toBe(1)
    expect(h[1].positions.get(2)).toBe(1)
  })
})

describe('estadísticas', () => {
  it('rachas, % y contra corriente', () => {
    const ana = player(1, 'Ana'), bea = player(2, 'Bea'), carlos = player(3, 'Carlos')
    const ms = [1, 2, 3, 4].map((i) =>
      match({ start_time: `2026-10-2${i}T18:00:00Z`, score_a: 1, score_b: 0 }),
    )
    const preds = [
      pred(1, ms[0], 1, 0), pred(1, ms[1], 1, 0), pred(1, ms[2], 0, 1), pred(1, ms[3], 1, 0),
      // ms[3]: Ana acierta, Bea y Carlos fallan → contra corriente
      pred(2, ms[3], 0, 1), pred(3, ms[3], 0, 1),
    ]
    const [a] = buildStats([ana, bea, carlos], ms, preds)
    expect(a.hitRate).toBe(0.75)
    expect(a.bestStreak).toBe(2)
    expect(a.currentStreak).toBe(1)
    expect(a.contrarian).toBe(1)
    expect(a.playoffHitRate).toBeNull()
  })
})

describe('tabla suiza', () => {
  it('cuenta V-D y marca clasificados y eliminados', () => {
    const team = (id: number, short: string): Team => ({ id, name: short, short, region: '', logo_url: '' })
    const teams = [team(1, 'T1'), team(2, 'GEN'), team(3, 'G2')]
    const ms = [
      match({ team_a: 1, team_b: 2, score_a: 1, score_b: 0 }),
      match({ team_a: 1, team_b: 3, best_of: 3, score_a: 2, score_b: 1 }),
      match({ team_a: 2, team_b: 1, score_a: 0, score_b: 1 }),
      match({ team_a: 2, team_b: 3, score_a: 0, score_b: 1 }),
      match({ team_a: 3, team_b: 2, score_a: null, score_b: null }),
    ]
    const rows = swissStandings(teams, ms)
    expect(rows.map((r) => `${r.team.short} ${r.wins}-${r.losses} ${r.status}`)).toEqual([
      'T1 3-0 qualified',
      'G2 1-1 alive',
      'GEN 0-3 eliminated',
    ])
  })
})

describe('hora de Madrid', () => {
  it('convierte UTC a Madrid en verano y en invierno', () => {
    // 23 oct: CEST (UTC+2); 30 oct: ya CET (UTC+1, el cambio es el 25 oct de 2026)
    expect(madridTime('2026-10-23T16:00:00Z')).toBe('18:00')
    expect(madridTime('2026-10-30T16:00:00Z')).toBe('17:00')
    expect(madridDay('2026-10-23T22:30:00Z')).toBe('2026-10-24')
    expect(madridInputValue('2026-10-23T16:05:00Z')).toBe('2026-10-23T18:05')
  })
  it('cuenta atrás', () => {
    expect(countdown(0)).toBe('cerrado')
    expect(countdown(90 * 1000)).toBe('1 min')
    expect(countdown((2 * 86400 + 4 * 3600) * 1000)).toBe('2 d 4 h')
  })
})

describe('cuadro de eliminatorias', () => {
  it('coloca cada cuarto bajo la semifinal que juega su ganador', () => {
    const q = [
      match({ stage: 'qf', round: null, team_a: 1, team_b: 2, score_a: 3, score_b: 0, start_time: '2026-11-01T10:00:00Z' }),
      match({ stage: 'qf', round: null, team_a: 3, team_b: 4, score_a: 0, score_b: 3, start_time: '2026-11-01T14:00:00Z' }),
      match({ stage: 'qf', round: null, team_a: 5, team_b: 6, score_a: 3, score_b: 1, start_time: '2026-11-02T10:00:00Z' }),
      match({ stage: 'qf', round: null, team_a: 7, team_b: 8, score_a: 1, score_b: 3, start_time: '2026-11-02T14:00:00Z' }),
    ]
    // La primera semi enfrenta al ganador del 1.º cuarto con el del 3.º
    const s1 = match({ stage: 'sf', round: null, team_a: 1, team_b: 5, start_time: '2026-11-08T10:00:00Z' })
    const b = arrangeBracket([...q, s1])
    expect(b.qf.map((m) => m?.id)).toEqual([q[0].id, q[2].id, q[1].id, q[3].id])
    expect(b.sf).toEqual([s1, null])
    expect(b.final).toBeNull()
  })

  it('deja huecos vacíos si aún no hay cruces', () => {
    expect(arrangeBracket([])).toEqual({ qf: [null, null, null, null], sf: [null, null], final: null })
  })
})
