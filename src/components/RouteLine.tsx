/** 시드 기반 결정적 루트라인 — 지도/기록선 비주얼 아이덴티티 */
export default function RouteLine({
  seed,
  className,
  stroke = '#1f3fcc',
}: {
  seed: string
  className?: string
  stroke?: string
}) {
  let h = 7
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 100000
  const rand = () => {
    h = (h * 9301 + 49297) % 233280
    return h / 233280
  }
  const n = 8
  const pts: [number, number][] = [[10, 35 + rand() * 40]]
  for (let i = 1; i <= n; i++) {
    pts.push([(180 / n) * i + 10 + (rand() - 0.5) * 12, 15 + rand() * 70])
  }
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
  const last = pts[n]

  return (
    <svg viewBox="0 0 200 100" className={className} preserveAspectRatio="none">
      {/* 그리드 — 지도 느낌 */}
      {[25, 50, 75].map((gy) => (
        <line key={`h${gy}`} x1="0" y1={gy} x2="200" y2={gy} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
      ))}
      {[33, 66, 100, 133, 166].map((gx) => (
        <line key={`v${gx}`} x1={gx} y1="0" x2={gx} y2="100" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
      ))}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={pts[0][0]} cy={pts[0][1]} r="3.5" fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  )
}
