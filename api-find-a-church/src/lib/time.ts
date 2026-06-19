/**
 * Cálculo de "próxima ocorrência" respeitando o fuso configurado (APP_TIMEZONE).
 * Brasil hoje não tem horário de verão; mesmo assim convertemos via offset real
 * do fuso para o instante, então DST não quebra.
 */
import { env } from '@/config/env'

const TZ = env.APP_TIMEZONE

type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number; dow: number }

const PART_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
})

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Componentes do relógio de parede (no fuso TZ) para um instante. */
export function wallParts(instant: Date): Parts {
  const p = PART_FMT.formatToParts(instant)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '0'
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hh: Number(get('hour')),
    mm: Number(get('minute')),
    ss: Number(get('second')),
    dow: DOW[get('weekday')] ?? 0,
  }
}

/** Offset do fuso (ms) num dado instante: wallClockAsUTC - instante. */
function tzOffsetMs(instant: Date): number {
  const w = wallParts(instant)
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss)
  return asUtc - instant.getTime()
}

/** Converte um horário de parede (no fuso TZ) para o instante UTC correspondente. */
export function zonedWallToInstant(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off = tzOffsetMs(new Date(guess))
  return new Date(guess - off)
}

function parseHHmm(s: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(s)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (hh > 23 || mm > 59) return null
  return [hh, mm]
}

/**
 * Próxima ocorrência de uma missa a partir de `from`.
 * - recorrente: usa `dayOfWeek` (0=domingo) + `startTime`.
 * - pontual: usa `date` (Y-M-D) + `startTime`; retorna null se já passou.
 */
export function nextOccurrence(
  schedule: { dayOfWeek: number | null; date: Date | null; startTime: string },
  from: Date,
): Date | null {
  const hhmm = parseHHmm(schedule.startTime)
  if (!hhmm) return null
  const [hh, mm] = hhmm

  if (schedule.date) {
    // `date` é DATE (meia-noite UTC). Extraímos Y-M-D e combinamos com o horário.
    const y = schedule.date.getUTCFullYear()
    const mo = schedule.date.getUTCMonth() + 1
    const da = schedule.date.getUTCDate()
    const instant = zonedWallToInstant(y, mo, da, hh, mm)
    return instant.getTime() >= from.getTime() ? instant : null
  }

  if (schedule.dayOfWeek == null) return null
  const w = wallParts(from)
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = zonedWallToInstant(w.y, w.m, w.d + offset, hh, mm)
    const cw = wallParts(candidate)
    if (cw.dow !== schedule.dayOfWeek) continue
    if (candidate.getTime() >= from.getTime()) return candidate
  }
  return null
}

export { TZ }
