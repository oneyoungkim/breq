import { useEffect, useRef, useState } from 'react'
import type { GeoPoint, Profile, RunRecord } from '../types'
import { fmtPace } from '../logic'
import { fmtClock, saveAppRun } from '../runs'
import { Chip, inputCls, Tag } from '../components/ui'
import RoutePath from '../components/RoutePath'

type Phase = 'ready' | 'run' | 'pause' | 'done'

const gpsSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

// 정확도 튜닝 상수
const ACC_MAX = 40 // 이보다 정확도 나쁜 fix는 거리 계산에서 제외(m)
const MAX_SPEED = 12.5 // 러닝 상한 속도(m/s) — 초과 시 순간이동으로 간주
const PACE_WINDOW_MS = 15000 // 현재 페이스 롤링 창

/** 두 좌표 사이 거리(m) */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export default function RunTracker({
  profile,
  onClose,
  onMakeCert,
}: {
  profile: Profile
  onClose: () => void
  onMakeCert: (r: RunRecord) => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [useSim, setUseSim] = useState(!gpsSupported)
  const [elapsed, setElapsed] = useState(0)
  const [dist, setDist] = useState(0)
  const [curPace, setCurPace] = useState<number>(profile.paceSec ?? 480)
  const [splits, setSplits] = useState<number[]>([])
  const [memo, setMemo] = useState('')
  const [record, setRecord] = useState<RunRecord | null>(null)
  const [gpsErr, setGpsErr] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [fixes, setFixes] = useState(0)

  const lastAccepted = useRef<GeoPoint | null>(null)
  const trackRef = useRef<GeoPoint[]>([])
  const distRef = useRef(0)
  const paceWin = useRef<{ t: number; d: number }[]>([])
  const lastSplitAt = useRef(0)
  const simTime = useRef(0)
  const startedAt = useRef('')

  const secure = typeof window !== 'undefined' && window.isSecureContext

  // ── 시뮬레이션 모드 ──
  useEffect(() => {
    if (phase !== 'run' || useSim === false) return
    const base = profile.paceSec ?? 480
    const id = setInterval(() => {
      const step = 10 // 시뮬레이션 초(×20 배속)
      simTime.current += step
      const pace =
        base * (1 + 0.05 * Math.sin(simTime.current / 150) + (Math.random() - 0.5) * 0.05)
      setCurPace(pace)
      setElapsed((e) => e + step)
      setDist((d) => d + step / pace)
    }, 500)
    return () => clearInterval(id)
  }, [phase, useSim, profile.paceSec])

  // ── 실제 GPS 모드: 1초 경과 타이머 ──
  useEffect(() => {
    if (phase !== 'run' || useSim) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [phase, useSim])

  // ── 실제 GPS 모드: 위치 추적 ──
  useEffect(() => {
    if (phase !== 'run' || useSim) return
    if (!gpsSupported) {
      setUseSim(true)
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords
        const acc = c.accuracy ?? 999
        setAccuracy(acc)
        setFixes((n) => n + 1)
        if (acc > ACC_MAX) return // 정확도 나쁜 fix는 거리에서 제외
        const p: GeoPoint = {
          lat: c.latitude,
          lng: c.longitude,
          t: pos.timestamp,
          acc,
          alt: c.altitude ?? undefined,
        }
        const prev = lastAccepted.current
        if (!prev) {
          lastAccepted.current = p
          trackRef.current.push(p)
          return
        }
        const d = haversine(prev.lat, prev.lng, p.lat, p.lng) // m
        const dt = Math.max((p.t - prev.t) / 1000, 0.001)
        // 제자리 GPS 드리프트 차단: 이동이 정확도 절반(최소 4m)보다 작으면 무시
        if (d < Math.max(acc * 0.5, 4)) return
        // 순간이동(터널/신호 튐) 차단
        if (d / dt > MAX_SPEED) {
          lastAccepted.current = p
          return
        }
        distRef.current += d / 1000
        setDist(distRef.current)
        lastAccepted.current = p
        trackRef.current.push(p)
        // 현재 페이스 — 최근 15초 구간으로 산출(단일 fix 흔들림 방지)
        paceWin.current.push({ t: p.t, d: distRef.current })
        while (paceWin.current.length > 1 && p.t - paceWin.current[0].t > PACE_WINDOW_MS) {
          paceWin.current.shift()
        }
        const w0 = paceWin.current[0]
        const dd = distRef.current - w0.d
        const ddt = (p.t - w0.t) / 1000
        if (dd > 0.012) setCurPace(ddt / dd)
      },
      (err) => setGpsErr(err.message || 'GPS 신호를 받지 못했어요'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [phase, useSim])

  // km를 넘을 때마다 구간 기록 (두 모드 공통)
  useEffect(() => {
    if (Math.floor(dist) > splits.length) {
      const split = Math.round(elapsed - lastSplitAt.current)
      lastSplitAt.current = elapsed
      setSplits((s) => [...s, split])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist])

  const begin = () => {
    setElapsed(0)
    setDist(0)
    setSplits([])
    setCurPace(profile.paceSec ?? 480)
    setGpsErr(null)
    setAccuracy(null)
    setFixes(0)
    lastAccepted.current = null
    trackRef.current = []
    distRef.current = 0
    paceWin.current = []
    lastSplitAt.current = 0
    simTime.current = 0
    startedAt.current = new Date().toISOString()
    setPhase('run')
  }

  const finish = () => {
    const now = new Date()
    const started = startedAt.current ? new Date(startedAt.current) : now
    setRecord({
      id: `run-${Date.now()}`,
      source: 'app',
      dateLabel: '오늘',
      startTime: hhmm(started),
      distanceKm: Math.round(dist * 100) / 100,
      durationSec: Math.round(elapsed),
      splits,
      avgHr: useSim ? 140 + Math.round(Math.random() * 18) : undefined,
      cadence: useSim ? 160 + Math.round(Math.random() * 14) : undefined,
      course: profile.region,
      track: trackRef.current.length >= 2 ? trackRef.current.slice() : undefined,
      startedAt: started.toISOString(),
      endedAt: now.toISOString(),
    })
    setPhase('done')
  }

  const save = (thenCert: boolean) => {
    if (!record) return
    const r = { ...record, memo: memo.trim() || undefined }
    saveAppRun(r)
    if (thenCert) onMakeCert(r)
    else onClose()
  }

  const avgPace = dist > 0.03 ? elapsed / dist : null

  // ───────── 시작 전 ─────────
  if (phase === 'ready') {
    return (
      <div className="flex min-h-dvh flex-col justify-center bg-bg px-5">
        <p className="eyebrow">{profile.region} · {useSim ? 'SIMULATION' : 'GPS READY'}</p>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-[-0.02em] text-ink">
          오늘의 러닝,
          <br />
          시작할까요?
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-mute">
          {useSim
            ? '시뮬레이션 모드 — 실제 이동 없이 거리·페이스가 채워져요.'
            : '시작을 누르면 GPS로 거리·페이스·구간이 실시간 측정돼요. 야외에서 화면을 켠 채 달려주세요.'}
        </p>

        {/* 모드 선택 */}
        <div className="mt-5 flex items-center gap-2">
          <Chip active={!useSim} onClick={() => gpsSupported && setUseSim(false)}>
            실제 GPS
          </Chip>
          <Chip active={useSim} onClick={() => setUseSim(true)}>
            시뮬레이션
          </Chip>
        </div>

        {!useSim && !secure && (
          <p className="mt-4 rounded-[6px] border border-route/40 bg-route/10 px-3.5 py-3 text-[12px] leading-relaxed text-ink">
            ⚠ 지금 주소(http)에서는 브라우저가 GPS를 막아요. <b>https로 접속</b>하거나
            시뮬레이션을 사용하세요. (자세한 건 README의 GPS 테스트 안내)
          </p>
        )}

        <button
          onClick={begin}
          className="mt-8 flex h-24 w-full items-center justify-center rounded-[6px] bg-brand text-[22px] font-black tracking-[0.32em] text-white shadow-2xl shadow-brand/30 active:scale-[0.98]"
        >
          START
        </button>
        <div className="mt-5 flex items-center gap-2">
          <Tag tone="amber">프로토타입</Tag>
          <span className="text-[11px] text-mute">
            {useSim ? '시뮬레이션 ×20 배속' : 'GPS 고정밀 모드'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="mt-10 self-start text-[13px] font-semibold text-mute"
        >
          ← 돌아가기
        </button>
      </div>
    )
  }

  // ───────── 러닝 중 / 일시정지 ─────────
  if (phase === 'run' || phase === 'pause') {
    return (
      <div className="flex min-h-dvh flex-col bg-bg px-5 pb-8 pt-12">
        <p className="flex items-center justify-center gap-2 text-center">
          <span
            className={`h-2 w-2 rounded-full ${
              phase === 'run' ? 'animate-pulse bg-brand' : 'bg-mute'
            }`}
          />
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-mute">
            {phase === 'pause' ? 'PAUSED' : useSim ? 'SIMULATING' : 'GPS RECORDING'}
          </span>
        </p>

        {/* GPS 상태 줄 */}
        {!useSim && (
          <p className="mt-1 text-center text-[11px] text-mute">
            {gpsErr ? (
              <span className="text-route">⚠ {gpsErr}</span>
            ) : fixes === 0 ? (
              'GPS 신호 잡는 중…'
            ) : (
              `GPS 정확도 ±${Math.round(accuracy ?? 0)}m · ${fixes} fixes`
            )}
          </p>
        )}
        {!useSim && gpsErr && (
          <button
            onClick={() => setUseSim(true)}
            className="mx-auto mt-2 rounded-[4px] bg-card px-3 py-1.5 text-[12px] font-bold text-ink"
          >
            시뮬레이션으로 전환
          </button>
        )}

        <p className="mt-3 text-center text-[76px] font-black tabular-nums leading-none tracking-[-0.03em] text-ink">
          {fmtClock(elapsed)}
        </p>
        <div className="mt-10 grid grid-cols-3 divide-x divide-line border-y border-line">
          {[
            { k: 'DISTANCE', v: dist.toFixed(2), s: 'km' },
            {
              k: 'PACE',
              v: useSim ? fmtPace(curPace) : avgPace ? fmtPace(avgPace) : '-',
              s: '/km',
            },
            { k: 'AVG PACE', v: avgPace ? fmtPace(avgPace) : '-', s: '/km' },
          ].map((c) => (
            <div key={c.k} className="px-2 py-4 text-center">
              <p className="eyebrow">{c.k}</p>
              <p className="mt-1.5 text-[22px] font-extrabold tabular-nums text-ink">{c.v}</p>
              <p className="text-[10px] text-mute">{c.s}</p>
            </div>
          ))}
        </div>

        {!useSim && trackRef.current.length >= 2 && (
          <div className="mt-5 rounded-2xl border border-line bg-card p-3">
            <p className="eyebrow mb-1">ROUTE · 실시간</p>
            <RoutePath
              points={trackRef.current}
              className="h-32 w-full text-route"
              strokeWidth={4}
            />
          </div>
        )}

        {splits.length > 0 && (
          <div className="mt-5 rounded-2xl border border-line bg-card p-4">
            <p className="eyebrow mb-2">SPLITS</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {splits.map((s, i) => (
                <span
                  key={i}
                  className="shrink-0 rounded-lg bg-card2 px-2.5 py-1.5 text-[12px] font-bold tabular-nums text-ink"
                >
                  {i + 1}km {fmtPace(s)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <button
            onClick={() => setPhase(phase === 'run' ? 'pause' : 'run')}
            className="rounded-2xl bg-card py-4 text-[16px] font-bold text-ink"
          >
            {phase === 'run' ? '일시정지' : '재개'}
          </button>
          <button
            onClick={finish}
            className="rounded-2xl bg-brand py-4 text-[16px] font-bold text-white"
          >
            종료
          </button>
        </div>
      </div>
    )
  }

  // ───────── 완료 요약 ─────────
  if (!record) return null
  const rAvg = record.durationSec / Math.max(record.distanceKm, 0.01)
  const minSplit = record.splits.length ? Math.min(...record.splits) : 0

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 pb-8 pt-10">
      <p className="text-center text-[11px] font-extrabold tracking-[0.22em] text-mint">
        RUN COMPLETE
      </p>
      <p className="mt-2 text-center text-[52px] font-black tabular-nums tracking-[-0.03em] text-ink">
        {record.distanceKm}
        <span className="text-[20px] font-bold text-mute"> km</span>
      </p>
      <p className="text-center text-[13px] text-mute">
        {record.dateLabel} {record.startTime} · {record.course}
      </p>

      <div className="mt-6 grid grid-cols-4 divide-x divide-line border-y border-line">
        {[
          { k: 'TIME', v: fmtClock(record.durationSec) },
          { k: 'PACE', v: fmtPace(rAvg) },
          { k: 'BPM', v: record.avgHr ? `${record.avgHr}` : '—' },
          { k: 'SPM', v: record.cadence ? `${record.cadence}` : '—' },
        ].map((c) => (
          <div key={c.k} className="px-1 py-3.5 text-center">
            <p className="text-[15px] font-extrabold tabular-nums text-ink">{c.v}</p>
            <p className="eyebrow mt-1">{c.k}</p>
          </div>
        ))}
      </div>

      {record.splits.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <p className="eyebrow mb-2.5">SPLITS</p>
          <div className="space-y-1.5">
            {record.splits.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-9 text-[11px] font-semibold text-mute">{i + 1}km</span>
                <div className="h-4 flex-1 overflow-hidden rounded-[2px] bg-card2">
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${(minSplit / s) * 100}%`,
                      background: s === minSplit ? '#0b9e68' : '#d9d6cd',
                    }}
                  />
                </div>
                <span
                  className="w-12 text-right text-[12px] font-bold tabular-nums"
                  style={{ color: s === minSplit ? '#0b9e68' : '#17171a' }}
                >
                  {fmtPace(s)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        className={`${inputCls} mt-4`}
        placeholder="메모 남기기 (선택) — 오늘 컨디션, 코스 느낌 등"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <div className="mt-auto space-y-2.5 pt-6">
        <button
          onClick={() => save(true)}
          className="w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white"
        >
          저장하고 인증 카드 만들기
        </button>
        <button
          onClick={() => save(false)}
          className="w-full rounded-2xl bg-card py-4 text-[15px] font-bold text-ink"
        >
          저장만 하기
        </button>
      </div>
    </div>
  )
}
