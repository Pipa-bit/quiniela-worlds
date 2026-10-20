export type Stage = 'swiss' | 'qf' | 'sf' | 'final'

export interface Team {
  id: number
  name: string
  short: string
  region: string
  logo_url: string
}

export interface Player {
  id: number
  name: string
  emoji: string
  color: string
}

export interface Match {
  id: number
  stage: Stage
  round: number | null
  team_a: number
  team_b: number
  best_of: 1 | 3 | 5
  start_time: string
  locked: boolean
  score_a: number | null
  score_b: number | null
}

export interface Prediction {
  player_id: number
  match_id: number
  score_a: number
  score_b: number
  updated_at: string
}

export const STAGE_LABEL: Record<Stage, string> = {
  swiss: 'Fase suiza',
  qf: 'Cuartos',
  sf: 'Semifinales',
  final: 'Final',
}

export function matchLabel(m: Pick<Match, 'stage' | 'round'>): string {
  return m.stage === 'swiss' ? `Suiza · Ronda ${m.round}` : STAGE_LABEL[m.stage]
}
