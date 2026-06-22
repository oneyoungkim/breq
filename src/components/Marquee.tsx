import type { ReactNode } from 'react'

/** 무한히 흐르는 텍스트 띠. children이 한 묶음(폭 50%)을 차지하고 2회 복제되어 seamless loop. */
export function Marquee({
  children,
  className = '',
  reverse = false,
  duration,
}: {
  children: ReactNode
  className?: string
  reverse?: boolean
  duration?: number
}) {
  return (
    <div className={`marquee ${className}`}>
      <div
        className="marquee-track"
        style={{
          animationDirection: reverse ? 'reverse' : undefined,
          animationDuration: duration ? `${duration}s` : undefined,
        }}
      >
        <span className="flex shrink-0">{children}</span>
        <span className="flex shrink-0" aria-hidden>
          {children}
        </span>
      </div>
    </div>
  )
}
