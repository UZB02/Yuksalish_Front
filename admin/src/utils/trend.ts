import type { TrendPoint } from '@/api/types'

export interface TrendCoord {
  x: number
  y: number
  date: string
  value: number
}

export interface TrendGeometry {
  coords: TrendCoord[]
  linePath: string
  areaPath: string
  yMin: number
  yMax: number
}

const dayMs = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

/**
 * Dinamika chizig'i geometriyasi (sof funksiya, testlash oson).
 * Bo'sh -> koordinatsiz; bitta nuqta -> markazda nuqta; ko'p -> sana bo'yicha proporsional x.
 */
export function buildTrend(
  points: TrendPoint[],
  width: number,
  height: number,
  pad = { top: 12, right: 16, bottom: 24, left: 36 },
  range?: { min: number; max: number },
): TrendGeometry {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) {
    return {
      coords: [],
      linePath: '',
      areaPath: '',
      yMin: range?.min ?? 0,
      yMax: range?.max ?? 100,
    }
  }
  const values = sorted.map((p) => p.dayScore)
  let yMin = range?.min ?? Math.min(...values)
  let yMax = range?.max ?? Math.max(...values)
  if (!range) {
    const margin = Math.max(2, (yMax - yMin) * 0.15)
    yMin = Math.floor(yMin - margin)
    yMax = Math.ceil(yMax + margin)
  }
  if (yMax === yMin) {
    yMax += 1
    yMin -= 1
  }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const t0 = dayMs(sorted[0]!.date)
  const t1 = dayMs(sorted[sorted.length - 1]!.date)
  const x = (date: string) =>
    sorted.length === 1 || t1 === t0
      ? pad.left + innerW / 2
      : pad.left + ((dayMs(date) - t0) / (t1 - t0)) * innerW
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * innerH

  const coords = sorted.map((p) => ({
    x: round(x(p.date)),
    y: round(y(p.dayScore)),
    date: p.date,
    value: p.dayScore,
  }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y}`).join(' ')
  const baseY = round(pad.top + innerH)
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1]!.x} ${baseY} L${coords[0]!.x} ${baseY} Z`
      : ''
  return { coords, linePath, areaPath, yMin, yMax }
}

const round = (n: number) => Math.round(n * 10) / 10
