// Todas las horas se muestran en hora de Madrid.
export const TZ = 'Europe/Madrid'

function parts(iso: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

/** '2026-10-23' (día en Madrid), sirve para agrupar y ordenar. */
export function madridDay(iso: string): string {
  const p = parts(iso)
  return `${p.year}-${p.month}-${p.day}`
}

/** '18:00' en Madrid. */
export function madridTime(iso: string): string {
  const p = parts(iso)
  return `${p.hour}:${p.minute}`
}

/** Valor para <input type="datetime-local"> en hora de Madrid: '2026-10-23T18:00'. */
export function madridInputValue(iso: string): string {
  return `${madridDay(iso)}T${madridTime(iso)}`
}

/** 'jueves, 23 de octubre' a partir de '2026-10-23'. */
export function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const s = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  )
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Cuenta atrás corta: '2 d 4 h', '3 h 12 min', '45 min', '30 s'. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'cerrado'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}
