import type { RunRecord } from '../types'
import type { HealthAuthStatus } from '../health'

/* ──────────────────────────────────────────────────────────────
   capacitor-health 어댑터 (iOS HealthKit)

   네이티브(iOS 앱) 런타임에서만 호출된다. 웹에서는 health.ts의
   isNativeHealthAvailable()가 false이므로 이 파일의 함수는 실행되지 않는다.
   capacitor-health 는 동적 import 라 웹 번들에는 별도 청크로만 들어간다.

   설치된 버전(capacitor-health@8): Health.isHealthAvailable /
   requestHealthPermissions / queryWorkouts. iOS 러닝 workoutType === 'running'.
   ────────────────────────────────────────────────────────────── */

const READ_PERMS = [
  'READ_WORKOUTS',
  'READ_DISTANCE',
  'READ_HEART_RATE',
  'READ_ACTIVE_CALORIES',
  'READ_ROUTE',
] as const

const pad = (n: number) => String(n).padStart(2, '0')

function dayLabel(d: Date): string {
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((a - b) / 86400000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** km 구간 추정 — HealthKit 워크아웃엔 km 스플릿이 없어 평균 페이스로 균등 분할.
 *  정밀 스플릿이 필요하면 includeRoute:true 로 받은 좌표/시간으로 계산하면 됨. */
function evenSplits(distanceKm: number, durationSec: number): number[] {
  const n = Math.floor(distanceKm)
  if (n < 1 || distanceKm <= 0) return []
  const per = Math.round(durationSec / distanceKm)
  return Array.from({ length: n }, () => per)
}

export async function authorize(): Promise<HealthAuthStatus> {
  const { Health } = await import('capacitor-health')
  const { available } = await Health.isHealthAvailable()
  if (!available) return 'unavailable'
  // iOS는 실제 허용/거부를 앱에 알려주지 않음 → 권한창을 띄운 뒤 granted로 간주
  // (플러그인 문서 명시. 데이터가 비면 사용자가 건강 앱에서 막은 것)
  await Health.requestHealthPermissions({ permissions: READ_PERMS as unknown as never })
  return 'granted'
}

export async function fetchRunningWorkouts(opts?: {
  since?: string
  limit?: number
}): Promise<RunRecord[]> {
  const { Health } = await import('capacitor-health')
  const end = new Date()
  const start = opts?.since
    ? new Date(opts.since)
    : new Date(end.getTime() - 1000 * 60 * 60 * 24 * 90) // 최근 90일
  const { workouts } = await Health.queryWorkouts({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    includeHeartRate: true,
    includeRoute: false,
    includeSteps: false,
  })

  return workouts
    .filter((w) => w.workoutType === 'running')
    .slice(0, opts?.limit ?? 50)
    .map((w): RunRecord => {
      const distanceKm = (w.distance ?? 0) / 1000
      const durationSec = Math.round(w.duration)
      const startDate = new Date(w.startDate)
      const hr = w.heartRate ?? []
      const avgHr = hr.length
        ? Math.round(hr.reduce((s, h) => s + h.bpm, 0) / hr.length)
        : undefined
      return {
        id: w.id ?? `hk-${w.startDate}`,
        source: 'apple',
        dateLabel: dayLabel(startDate),
        startTime: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationSec,
        splits: evenSplits(distanceKm, durationSec),
        avgHr,
        startedAt: w.startDate,
        endedAt: w.endDate,
        energyKcal: w.calories ? Math.round(w.calories) : undefined,
      }
    })
}
