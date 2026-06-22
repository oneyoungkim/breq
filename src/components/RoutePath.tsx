import { useId } from 'react'
import type { GeoPoint } from '../types'

/**
 * 실제 GPS 트랙을 정확한 축척(종횡비 보존)으로 그리는 경로 선.
 * 위경도 → 등장방형 투영(경도는 위도 코사인 보정) → 박스에 맞춰 정규화.
 */
export default function RoutePath({
  points,
  className = '',
  strokeWidth = 4,
  markers = true,
  height = 160,
  width = 320,
}: {
  points: GeoPoint[]
  className?: string
  strokeWidth?: number
  markers?: boolean
  height?: number
  width?: number
}) {
  const id = useId()
  const pad = Math.max(strokeWidth * 2, 10)

  if (!points || points.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="경로 없음" />
    )
  }

  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const k = Math.cos((meanLat * Math.PI) / 180)
  // 투영 좌표 (y는 북쪽이 위로 가도록 위도 반전)
  const proj = points.map((p) => ({ x: p.lng * k, y: -p.lat }))

  const xs = proj.map((p) => p.x)
  const ys = proj.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1e-9
  const spanY = maxY - minY || 1e-9

  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const drawnW = spanX * scale
  const drawnH = spanY * scale
  const offX = (width - drawnW) / 2
  const offY = (height - drawnH) / 2
  const sx = (x: number) => offX + (x - minX) * scale
  const sy = (y: number) => offY + (y - minY) * scale

  const d = proj.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')
  const start = proj[0]
  const end = proj[proj.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="러닝 경로">
      <defs>
        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={`url(#glow-${id})`}
      />
      {markers && (
        <>
          <circle cx={sx(start.x)} cy={sy(start.y)} r={strokeWidth * 1.6} fill="currentColor" />
          <circle cx={sx(start.x)} cy={sy(start.y)} r={strokeWidth * 0.7} fill="var(--color-bg, #fff)" />
          <circle
            cx={sx(end.x)}
            cy={sy(end.y)}
            r={strokeWidth * 1.8}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth * 0.6}
          />
          <circle cx={sx(end.x)} cy={sy(end.y)} r={strokeWidth * 0.9} fill="currentColor" />
        </>
      )}
    </svg>
  )
}

/** 트랙으로 정확한 거리(km) 재계산 — 검증/표시 보조용 */
export function trackDistanceKm(points: GeoPoint[]): number {
  if (!points || points.length < 2) return 0
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  let m = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
    m += 2 * R * Math.asin(Math.sqrt(s))
  }
  return Math.round((m / 1000) * 100) / 100
}
