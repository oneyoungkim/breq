import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GeoPoint, Profile, RunRecord } from '../types'
import { fmtPace } from '../logic'
import { fmtClock, saveAppRun } from '../runs'
import { Chip, inputCls, Tag } from '../components/ui'
import RoutePath from '../components/RoutePath'
import { GpsKalman, haversine, trackDistanceKm } from '../gps'
import { getLocationProvider, type Fix, type LocationWatch } from '../location'
import { COURSES, courseTimeSec, DIFFICULTY_TONE, type Course } from '../data/courses'
import CourseMiniMap from '../components/CourseMiniMap'
import CoursePin from '../components/CoursePin'

type Phase = 'ready' | 'run' | 'pause' | 'done'

const gpsSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

// 정밀도 튜닝 상수
const ACC_MAX = 25 // 이보다 정확도 나쁜 fix는 폐기(m) — 잡음 차단
const ACC_ANCHOR = 18 // 출발 기준점은 이 정확도 이내일 때만 확정(안정화 게이트)
const MAX_SPEED = 12.5 // 러닝 상한 속도(m/s) — 초과 시 순간이동(신호 튐)으로 간주
const KALMAN_Q = 3 // 칼만 프로세스 노이즈(m/s) — 러닝 보행 속도대
const PACE_WINDOW_MS = 15000 // 현재 페이스 롤링 창

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** 정확도(m) → 신호 품질 라벨 */
const gpsQuality = (acc: number | null) =>
  acc == null ? '—' : acc <= 8 ? '정밀' : acc <= 15 ? '양호' : '보통'

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
  const [locked, setLocked] = useState(false) // 출발 기준점 확정 여부(신호 안정화)
  const [targetKm, setTargetKm] = useState<'all' | 3 | 5 | 10 | 15>('all') // 추천 코스 거리 필터
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const lastAccepted = useRef<GeoPoint | null>(null)
  const trackRef = useRef<GeoPoint[]>([])
  const distRef = useRef(0)
  const paceWin = useRef<{ t: number; d: number }[]>([])
  const lastSplitAt = useRef(0)
  const simTime = useRef(0)
  const startedAt = useRef('')
  const kalman = useRef(new GpsKalman(KALMAN_Q))
  const anchored = useRef(false) // 거리 적산 시작했는지
  const reanchor = useRef(false) // 일시정지→재개 직후 1회: 유령 거리 방지
  const elapsedBase = useRef(0) // 일시정지까지 누적 경과(초)
  const segStart = useRef(0) // 현재 측정 구간 시작(epoch ms)

  const secure = typeof window !== 'undefined' && window.isSecureContext
  const nativeGps = getLocationProvider().isNative

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

  // ── 실제 GPS 모드: 경과 타이머 (벽시계 기반 — 백그라운드 throttle에도 정확) ──
  useEffect(() => {
    if (phase !== 'run' || useSim) return
    segStart.current = Date.now()
    const tick = () => setElapsed(elapsedBase.current + (Date.now() - segStart.current) / 1000)
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      // 구간 종료(일시정지/종료) 시 누적에 반영
      elapsedBase.current += (Date.now() - segStart.current) / 1000
      clearInterval(id)
    }
  }, [phase, useSim])

  // ── 위치 한 점(fix) 처리: 칼만 보정 → 게이트 → 거리·페이스 적산 ──
  const handleFix = useCallback((f: Fix) => {
    const acc = f.acc
    setAccuracy(acc)
    setFixes((n) => n + 1)
    // 좌표 유효성 + 정확도 게이트(나쁜 fix 폐기)
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return
    if (acc > ACC_MAX) return

    // 칼만 필터로 잡음 제거 → 보정된 위치/정확도 사용
    const k = kalman.current.process(f.lat, f.lng, acc, f.t)
    const fAcc = Math.min(kalman.current.accuracy, acc)
    const p: GeoPoint = {
      lat: k.lat,
      lng: k.lng,
      t: f.t,
      acc: Math.round(fAcc),
      alt: f.alt,
    }

    // 일시정지→재개 직후 1회: 기준점만 다시 잡고 거리 적산은 건너뜀(유령 거리 방지).
    // brk 표시로 경로/거리 재계산 시 정지 갭을 분절 처리.
    if (reanchor.current) {
      reanchor.current = false
      lastAccepted.current = p
      trackRef.current.push({ ...p, brk: true })
      return
    }

    // 출발 안정화: 정확도 좋은 fix가 들어와야 비로소 기준점 확정
    if (!anchored.current) {
      if (acc <= ACC_ANCHOR) {
        anchored.current = true
        setLocked(true)
        lastAccepted.current = p
        trackRef.current.push(p)
      }
      return
    }

    const prev = lastAccepted.current!
    const d = haversine(prev.lat, prev.lng, p.lat, p.lng) // m
    const dt = Math.max((p.t - prev.t) / 1000, 0.001)
    // 제자리 지터 차단: 이동이 (보정 정확도의 절반, 최소 3m)보다 작으면 적산 보류.
    // 기준점을 갱신하지 않으므로 느린 러너의 이동도 여러 fix에 걸쳐 누적된다.
    if (d < Math.max(fAcc * 0.5, 3)) return
    // 순간이동(터널/신호 튐) 차단 — 기준점만 옮기고 거리 미반영
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
  }, [])

  // ── 실제 GPS 모드: 위치 추적 (웹=foreground / 네이티브=백그라운드 지속) ──
  useEffect(() => {
    if (phase !== 'run' || useSim) return
    if (!gpsSupported && !nativeGps) {
      setUseSim(true)
      return
    }
    let watch: LocationWatch | null = null
    let cancelled = false
    getLocationProvider()
      .watch(handleFix, (msg) => setGpsErr(msg))
      .then((w) => {
        if (cancelled) w.stop()
        else watch = w
      })
      .catch((e) => setGpsErr(e instanceof Error ? e.message : 'GPS를 시작하지 못했어요'))
    return () => {
      cancelled = true
      watch?.stop()
    }
  }, [phase, useSim, nativeGps, handleFix])

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
    setLocked(false)
    lastAccepted.current = null
    trackRef.current = []
    distRef.current = 0
    paceWin.current = []
    lastSplitAt.current = 0
    simTime.current = 0
    kalman.current.reset()
    anchored.current = false
    reanchor.current = false
    elapsedBase.current = 0
    segStart.current = Date.now()
    startedAt.current = new Date().toISOString()
    setPhase('run')
  }

  const finish = () => {
    const now = new Date()
    const started = startedAt.current ? new Date(startedAt.current) : now
    const track = trackRef.current
    // 실제 GPS는 적산 거리 대신 최종 트랙으로 재계산해 일치 보장(부동소수 누적 오차 제거)
    const finalKm = !useSim && track.length >= 2 ? trackDistanceKm(track) : dist
    // 경과는 벽시계로 마감(타이머 throttle/지연 무시) — 달리는 중 종료 시 현재 구간 포함
    const finalSec =
      !useSim && phase === 'run'
        ? elapsedBase.current + (now.getTime() - segStart.current) / 1000
        : elapsed
    setRecord({
      id: `run-${Date.now()}`,
      source: 'app',
      dateLabel: '오늘',
      startTime: hhmm(started),
      distanceKm: Math.round(finalKm * 100) / 100,
      durationSec: Math.round(finalSec),
      splits,
      avgHr: useSim ? 140 + Math.round(Math.random() * 18) : undefined,
      cadence: useSim ? 160 + Math.round(Math.random() * 14) : undefined,
      course: selectedCourse?.name ?? profile.region,
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

  // 추천 코스 — 목표 거리대 필터 + 내 지역 우선
  const recommended = useMemo(() => {
    const inBucket = (km: number | null) => {
      if (km == null) return targetKm === 'all'
      if (targetKm === 'all') return true
      if (targetKm === 3) return km <= 4
      if (targetKm === 5) return km > 4 && km <= 7
      if (targetKm === 10) return km > 7 && km <= 13
      return km > 13 // 롱런
    }
    const near = (c: Course) =>
      !!profile.region && (c.region.includes(profile.region) || profile.region.includes(c.region))
    return COURSES.filter((c) => inBucket(c.distanceKm))
      .sort((a, b) => Number(near(b)) - Number(near(a)))
      .slice(0, 12)
  }, [targetKm, profile.region])

  // ───────── 시작 전 ─────────
  if (phase === 'ready') {
    return (
      <div className="flex min-h-dvh flex-col bg-bg px-5 pb-12 pt-12">
        <p className="eyebrow">{profile.region} · {useSim ? 'SIMULATION' : 'GPS READY'}</p>
        <h1 className="mt-2 text-[34px] font-black leading-tight tracking-[-0.02em] text-ink">
          오늘의 러닝,
          <br />
          시작할까요?
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-mute">
          {useSim
            ? '시뮬레이션 모드 — 실제 이동 없이 거리·페이스가 채워져요.'
            : nativeGps
              ? '시작을 누르면 GPS로 거리·페이스·구간이 실시간 측정돼요. 화면을 끄거나 주머니에 넣어도 계속 기록돼요.'
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

        {selectedCourse && (
          <div className="mt-5 rounded-[6px] border border-route bg-route/5 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold tracking-[0.12em] text-route">선택한 코스</p>
                <p className="truncate text-[15px] font-bold text-ink">{selectedCourse.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-mute">{selectedCourse.region}</p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="shrink-0 pl-3 text-[12px] font-semibold text-mute"
              >
                해제
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <Tag tone={DIFFICULTY_TONE[selectedCourse.difficulty] as 'mint' | 'sky' | 'amber'}>
                {selectedCourse.difficulty}
              </Tag>
              <span className="text-[12px] font-bold tabular-nums text-ink">
                {selectedCourse.distanceLabel}
              </span>
              {courseTimeSec(selectedCourse) != null && (
                <span className="text-[11px] text-mute">
                  · 약 {Math.round(courseTimeSec(selectedCourse)! / 60)}분
                </span>
              )}
              <span className="truncate text-[11px] text-mute">· {selectedCourse.useFor}</span>
            </div>
            {selectedCourse.nearStation && selectedCourse.nearStation !== '미확인' && (
              <p className="mt-1.5 text-[11px] text-mute">
                <span className="font-semibold text-ink/70">가까운 역</span> ·{' '}
                {selectedCourse.nearStation}
              </p>
            )}
            {selectedCourse.lat != null && selectedCourse.lng != null && (
              <div className="mt-2.5">
                <CourseMiniMap lat={selectedCourse.lat} lng={selectedCourse.lng} />
              </div>
            )}
            {selectedCourse.note && (
              <p className="mt-2 text-[11px] leading-relaxed text-mute">{selectedCourse.note}</p>
            )}
          </div>
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
            {useSim ? '시뮬레이션 ×20 배속' : nativeGps ? 'GPS 고정밀 · 백그라운드' : 'GPS 고정밀 모드'}
          </span>
        </div>
        {/* 추천 코스 — 목표 거리대 인기 코스 */}
        <div className="mt-9">
          <div className="flex items-center justify-between">
            <p className="eyebrow">추천 코스</p>
            <span className="text-[11px] text-mute">{recommended.length}개</span>
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {([['all', '전체'], [3, '3km'], [5, '5km'], [10, '10km'], [15, '롱런']] as const).map(
              ([k, label]) => (
                <Chip key={String(k)} active={targetKm === k} onClick={() => setTargetKm(k)}>
                  {label}
                </Chip>
              ),
            )}
          </div>
          <div className="mt-3 space-y-2">
            {recommended.length === 0 && (
              <p className="rounded-[8px] bg-card px-4 py-6 text-center text-[12px] text-mute">
                이 거리대 추천 코스가 없어요.
              </p>
            )}
            {recommended.map((c) => {
              const sel = selectedCourse?.id === c.id
              const t = courseTimeSec(c)
              const station =
                c.nearStation && c.nearStation !== '미확인' ? c.nearStation.split(',')[0].trim() : ''
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCourse(sel ? null : c)}
                  className={`w-full rounded-[8px] border bg-card p-3.5 text-left active:bg-card2 ${
                    sel ? 'border-route' : 'border-line'
                  }`}
                >
                  <div className="flex gap-3">
                    {c.lat != null && c.lng != null && (
                      <CoursePin lat={c.lat} lng={c.lng} className="h-[60px] w-[60px] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-ink">{c.name}</p>
                          <p className="mt-0.5 truncate text-[11px] text-mute">
                            {c.region}
                            {station && ` · ${station}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-extrabold tabular-nums text-ink">
                            {c.distanceKm ?? '—'}
                            <span className="text-[10px] font-bold text-mute">km</span>
                          </p>
                          {t != null && (
                            <p className="text-[10px] text-mute">약 {Math.round(t / 60)}분</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Tag tone={DIFFICULTY_TONE[c.difficulty] as 'mint' | 'sky' | 'amber'}>
                          {c.difficulty}
                        </Tag>
                        <span className="truncate text-[11px] text-mute">{c.useFor}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 self-start text-[13px] font-semibold text-mute"
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
            ) : !locked ? (
              <span className="text-route">정밀 GPS 안정화 중… ±{Math.round(accuracy ?? 0)}m</span>
            ) : (
              <>
                GPS {gpsQuality(accuracy)} · ±{Math.round(accuracy ?? 0)}m · {fixes} fixes
              </>
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
            onClick={() => {
              if (phase === 'run') {
                // 일시정지: 재개 첫 fix에서 정지 중 이동분을 거리에 더하지 않도록 표시
                if (!useSim) reanchor.current = true
                setPhase('pause')
              } else {
                setPhase('run')
              }
            }}
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
