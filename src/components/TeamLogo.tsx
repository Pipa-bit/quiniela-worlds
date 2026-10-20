import { logoSrc } from '../lib/api'
import type { Team } from '../lib/types'

export default function TeamLogo({ team, size = 36 }: { team?: Team; size?: number }) {
  if (team?.logo_url) {
    return <img className="logo" src={logoSrc(team.logo_url)} alt={team.short} width={size} height={size} loading="lazy" />
  }
  return (
    <span className="logo logo-fallback" style={{ width: size, height: size, fontSize: size * 0.32 }}>
      {team?.short ?? '?'}
    </span>
  )
}
