import React, { Fragment, useMemo } from 'react'
import { BreqMark } from '../components/BreqLogo'

const STEAM = [
  { x: '6%',  size: 15, dur: '2.9s', del: '2.2s', drift: '10px'  },
  { x: '20%', size: 11, dur: '3.5s', del: '2.9s', drift: '-8px'  },
  { x: '33%', size: 18, dur: '2.7s', del: '2.4s', drift: '5px'   },
  { x: '48%', size: 10, dur: '3.3s', del: '3.1s', drift: '-13px' },
  { x: '61%', size: 14, dur: '2.8s', del: '2.3s', drift: '9px'   },
  { x: '76%', size: 12, dur: '3.6s', del: '3.6s', drift: '-6px'  },
  { x: '89%', size: 9,  dur: '3.1s', del: '4.0s', drift: '7px'   },
]

const QUOTE_KEY = 'runnersway.introQuote'

const BREQ_QUOTES = [
  {
    en: 'The best run is the one that brings you back.',
    ko: '최고의 러닝은 다시 나에게 돌아오게 하는 러닝이다.',
  },
  {
    en: 'Run less like a number, more like a signal.',
    ko: '숫자처럼 뛰지 말고, 신호처럼 남겨라.',
  },
  {
    en: 'Your route is proof that you kept moving.',
    ko: '너의 루트는 멈추지 않았다는 증거다.',
  },
  {
    en: 'Pace is temporary. Returning is the ritual.',
    ko: '페이스는 지나가고, 돌아오는 습관은 남는다.',
  },
  {
    en: 'A good run changes the shape of the day.',
    ko: '좋은 러닝은 하루의 모양을 바꾼다.',
  },
  {
    en: 'Start where you are. Make it yours.',
    ko: '지금 있는 곳에서 시작하고, 네 것으로 만들어라.',
  },
]

function pickIntroQuote() {
  try {
    const last = Number(localStorage.getItem(QUOTE_KEY))
    const pool = BREQ_QUOTES.map((_, i) => i).filter((i) => i !== last)
    const next = pool[Math.floor(Math.random() * pool.length)] ?? 0
    localStorage.setItem(QUOTE_KEY, String(next))
    return BREQ_QUOTES[next]
  } catch {
    return BREQ_QUOTES[Math.floor(Math.random() * BREQ_QUOTES.length)]
  }
}

function WordReveal({
  text,
  className = '',
  baseDelay = 0,
  stagger = 65,
}: {
  text: string
  className?: string
  baseDelay?: number
  stagger?: number
}) {
  const words = text.split(' ')
  return (
    <p className={className}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}>
            <span
              className="word-inner"
              style={{ animationDelay: `${baseDelay + i * stagger}ms` }}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </p>
  )
}

export default function Intro({
  onDone,
  onStartRun,
}: {
  onDone: () => void
  onStartRun: () => void
}) {
  const quote = useMemo(pickIntroQuote, [])

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-bg px-6 pb-9 pt-6">
      {/* center hero */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        {/* GPS 마크 — 단일 히어로. 라인 드로잉이 오프닝(무드 영상 제거로 시선 집중) */}
        <div className="club-shadow rounded-[10px] bg-ink px-8 py-7">
          <BreqMark size={112} className="route-glow text-route" animate />
        </div>

        {/* BREQ. — 라인 드로잉 완료 후 올라옴 + 수증기 */}
        <div className="intro-rise" style={{ animationDelay: '1.45s', marginTop: 12 }}>
          <div className="relative inline-block">
            {STEAM.map((s, i) => (
              <span
                key={i}
                className="steam-particle"
                style={{
                  left: s.x,
                  top: '8%',
                  width: s.size,
                  height: s.size,
                  '--sdur': s.dur,
                  '--sdel': s.del,
                  '--sdrift': s.drift,
                } as React.CSSProperties}
              />
            ))}
            <h1
              className="text-[76px] font-black tracking-[-0.04em] text-ink"
              style={{ lineHeight: 1 }}
            >
              BREQ<span className="text-route">.</span>
            </h1>
          </div>
        </div>

        {/* 인용문 한 줄(한글 메인) — 영문 라인 제거로 군더더기 정리 */}
        <WordReveal
          text={quote.ko}
          className="mt-6 w-full max-w-[320px] px-1 text-center text-[16px] font-bold leading-snug tracking-[-0.01em] text-ink"
          baseDelay={1500}
          stagger={55}
        />
      </div>

      {/* cta */}
      <div className="intro-rise w-full space-y-2" style={{ animationDelay: '2.85s' }}>
        <button
          onClick={onDone}
          className="flex w-full items-center justify-between rounded-[6px] bg-ink px-6 py-4 shadow-xl shadow-ink/20 active:scale-[0.99]"
        >
          <span className="font-mono text-[14px] font-bold tracking-[0.34em] text-white">
            START
          </span>
          <span className="text-[18px] text-route">→</span>
        </button>
        <button
          onClick={onStartRun}
          className="flex w-full items-center justify-between rounded-[6px] border border-route bg-route px-6 py-4 shadow-xl shadow-route/20 active:scale-[0.99]"
        >
          <span className="text-[15px] font-extrabold text-white">러닝 시작하기</span>
          <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-white/70">
            QUICK RUN
          </span>
        </button>
      </div>
    </div>
  )
}
