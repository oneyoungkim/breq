/**
 * BREQ 심볼 — GPS 러닝 트랙 라인.
 * 활동 지도 위에 남는 유기적인 러닝 경로를 닮은 라인 마크.
 */
import { useId } from 'react'

export function BreqMark({
  size = 64,
  className = '',
  animate = false,
}: {
  size?: number
  className?: string
  animate?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const glowId = `breq-glow-${uid}`

  const traceProps = animate
    ? ({ pathLength: 1, style: { strokeDasharray: 1, strokeDashoffset: 1 } } as const)
    : {}

  return (
    <svg
      width={size}
      height={(size * 92) / 120}
      viewBox="0 0 120 92"
      fill="none"
      className={className}
      aria-label="BREQ"
    >
      <defs>
        {/* 라인에 은은한 번짐 — GPS 루트 글로우 */}
        <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 주변 지도/보조 트랙 */}
      <path
        d="M18 24 C29 13 48 15 56 28 C63 39 51 48 39 43 C28 39 25 50 34 58 C45 68 66 67 75 56"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.22"
        filter={`url(#${glowId})`}
        className={animate ? 'breq-trace' : ''}
        {...traceProps}
        style={{ ...traceProps.style, animationDelay: '0.04s' }}
      />
      <path
        d="M86 16 C74 23 70 34 78 42 C86 50 99 44 102 55 C106 68 91 78 76 75"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.22"
        filter={`url(#${glowId})`}
        className={animate ? 'breq-trace' : ''}
        {...traceProps}
        style={{ ...traceProps.style, animationDelay: '0.12s' }}
      />

      {/* 메인 GPS 활동 경로 */}
      <path
        d="M12 62 C22 50 31 52 40 58 C49 64 60 63 67 53 C75 41 68 29 79 21 C91 12 107 22 103 37 C100 49 85 48 80 59 C75 70 87 83 104 75"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="1"
        filter={`url(#${glowId})`}
        className={animate ? 'breq-trace' : ''}
        {...traceProps}
        style={{ ...traceProps.style, animationDelay: '0.18s' }}
      />

      {/* 스타트 마커 */}
      <circle cx="12" cy="62" r="3.2" fill="currentColor" opacity="0.95" />

      {/* km 마커 */}
      <circle cx="41" cy="58" r="2.4" fill="currentColor" opacity="0.42" />
      <circle cx="68" cy="52" r="2.4" fill="currentColor" opacity="0.42" />
      <circle cx="82" cy="21" r="2.4" fill="currentColor" opacity="0.42" />
      <circle cx="80" cy="60" r="2.4" fill="currentColor" opacity="0.42" />

      {/* 피니시 마커 */}
      <circle
        cx="104"
        cy="75"
        r="11"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.22"
        className={animate ? 'breq-dot-ring' : ''}
      />
      <circle
        cx="104"
        cy="75"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
        className={animate ? 'breq-dot' : ''}
      />
      <circle
        cx="104"
        cy="75"
        r="4.5"
        fill="currentColor"
        className={animate ? 'breq-dot' : ''}
      />
    </svg>
  )
}

/** 심볼 + 워드마크 락업 (가로) */
export function BreqLockup({
  className = '',
  markSize = 30,
}: {
  className?: string
  markSize?: number
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BreqMark size={markSize} className="text-route" />
      <span className="text-[20px] font-black tracking-[-0.02em] text-ink">
        BREQ<span className="text-route">.</span>
      </span>
    </span>
  )
}
