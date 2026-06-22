import type { RunRecord, RunSource } from './types'

export const SOURCE_META: Record<RunSource, { icon: string; name: string }> = {
  app: { icon: 'BRQ', name: 'BREQ' },
  apple: { icon: 'APL', name: 'Apple 피트니스' },
  garmin: { icon: 'GRM', name: 'Garmin' },
  nike: { icon: 'NRC', name: 'Nike Run Club' },
  strava: { icon: 'STR', name: 'Strava' },
}

const RUNS_KEY = 'runnersway.runs'

export function loadAppRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) ?? '[]') as RunRecord[]
  } catch {
    return []
  }
}

export function saveAppRun(r: RunRecord) {
  localStorage.setItem(RUNS_KEY, JSON.stringify([r, ...loadAppRuns()]))
}

export function connectedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('runnersway.integrations') ?? '[]') as string[]
  } catch {
    return []
  }
}

/** 평균 페이스(초/km) 주변에서 자연스럽게 흔들리는 구간 기록 생성 */
function splitsAround(avgSec: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    Math.round(avgSec * (1 + Math.sin(i * 2.3 + 1) * 0.045)),
  )
}

function mk(
  id: string,
  source: RunSource,
  dateLabel: string,
  startTime: string,
  distanceKm: number,
  durationSec: number,
  course: string,
  avgHr?: number,
  cadence?: number,
): RunRecord {
  return {
    id,
    source,
    dateLabel,
    startTime,
    distanceKm,
    durationSec,
    splits: splitsAround(Math.round(durationSec / distanceKm), Math.floor(distanceKm)),
    avgHr,
    cadence,
    course,
  }
}

/** 연동된 서비스의 목업 동기화 기록 */
export function mockIntegrationRuns(connected: string[]): RunRecord[] {
  const all: RunRecord[] = [
    mk('ig-apple-1', 'apple', '오늘', '07:12', 4.1, 27 * 60 + 10, '동네 한 바퀴', 148, 166),
    mk('ig-garmin-1', 'garmin', '어제', '18:42', 5.2, 33 * 60 + 24, '반포한강공원', 151, 172),
    mk('ig-apple-2', 'apple', '6/10 (수)', '19:40', 6.0, 40 * 60 + 21, '한강 야간런', 153, 168),
    mk('ig-nike-1', 'nike', '6/9 (화)', '20:05', 3.0, 21 * 60 + 30, '트레드밀', 144, 160),
    mk('ig-strava-1', 'strava', '6/8 (월)', '06:30', 8.4, 52 * 60 + 40, '잠수교 왕복', 156, 170),
  ]
  return all.filter((r) => connected.includes(r.source))
}

const HEALTH_KEY = 'runnersway.healthRuns'

/** 워치/건강(HealthKit) 동기화로 들어온 러닝 캐시 — health.ts가 채운다 */
export function loadHealthRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HEALTH_KEY) ?? '[]') as RunRecord[]
  } catch {
    return []
  }
}
export function saveHealthRuns(runs: RunRecord[]) {
  localStorage.setItem(HEALTH_KEY, JSON.stringify(runs))
}

/** 앱 기록 + 워치/연동 기록 전체 (앱 기록이 위로)
 *  동기화 캐시가 있으면 그걸, 없으면(구버전 호환) 연결된 소스의 목업을 사용 */
export function allRecentRuns(): RunRecord[] {
  const cache = loadHealthRuns()
  const fromHealth = cache.length ? cache : mockIntegrationRuns(connectedIds())
  return [...loadAppRuns(), ...fromHealth]
}

export const fmtClock = (sec: number) => {
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`
}
