import type { RunRecord, RunSource } from './types'
import {
  loadHealthRuns,
  mockIntegrationRuns,
  saveHealthRuns,
  SOURCE_META,
} from './runs'

/* ──────────────────────────────────────────────────────────────
   BREQ 워치/건강 연동 (HealthKit 지향 설계)

   목표: "애플워치가 이미 기록한 러닝(HKWorkout)을 읽어와 BREQ 기록으로
   합친다." 웹/Windows에서는 실제 HealthKit을 호출할 수 없으므로 지금은
   MockHealthProvider 가 동작하고, 화면은 HealthProvider 인터페이스에만
   의존한다. iOS 네이티브 빌드에서 HealthKitProvider 로만 갈아끼우면 된다.

   교체 지점:
   - getHealthProvider(): 네이티브면 HealthKitProvider, 아니면 Mock
   - HealthKitProvider.requestAuthorization / fetchWorkouts 의 TODO(native)
   ────────────────────────────────────────────────────────────── */

export type HealthAuthStatus = 'granted' | 'denied' | 'unavailable'

/** 워치/건강 소스 한 곳에 대한 공통 계약 */
export interface HealthProvider {
  id: RunSource
  /** 이 기기/플랫폼에서 사용 가능한가 (HealthKit은 iOS 네이티브에서만) */
  isAvailable(): Promise<boolean>
  /** 읽기 권한 요청 */
  requestAuthorization(): Promise<HealthAuthStatus>
  /** 러닝 워크아웃을 RunRecord[]로 가져오기 (최신순) */
  fetchWorkouts(opts?: { since?: string; limit?: number }): Promise<RunRecord[]>
}

/** Capacitor 네이티브 컨테이너(=iOS 앱) 안에서 실행 중인지 */
export function isNativeHealthAvailable(): boolean {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform())
}

/** 웹/프로토타입용 목업 — 실제 HealthKit이 줄 데이터의 형태를 흉내 낸다 */
class MockHealthProvider implements HealthProvider {
  constructor(public id: RunSource) {}
  async isAvailable() {
    return true
  }
  async requestAuthorization(): Promise<HealthAuthStatus> {
    return 'granted'
  }
  async fetchWorkouts(): Promise<RunRecord[]> {
    // runs.ts의 목업 동기화 데이터에서 이 소스 것만
    return mockIntegrationRuns([this.id])
  }
}

/** iOS 네이티브 전용 — capacitor-health 어댑터(src/native/healthkit.ts)로 위임.
 *  웹에서는 호출되지 않으며, 어댑터는 capacitor-health를 동적 import 한다. */
class HealthKitProvider implements HealthProvider {
  constructor(public id: RunSource) {}

  async isAvailable() {
    return isNativeHealthAvailable()
  }

  async requestAuthorization(): Promise<HealthAuthStatus> {
    const { authorize } = await import('./native/healthkit')
    return authorize()
  }

  async fetchWorkouts(opts?: { since?: string; limit?: number }): Promise<RunRecord[]> {
    const { fetchRunningWorkouts } = await import('./native/healthkit')
    return fetchRunningWorkouts(opts)
  }
}

export function getHealthProvider(id: RunSource): HealthProvider {
  return isNativeHealthAvailable() ? new HealthKitProvider(id) : new MockHealthProvider(id)
}

export function providerName(id: RunSource) {
  return SOURCE_META[id]?.name ?? id
}

// ── 동기화 상태 (마지막 동기화 시각) ──
const LAST_SYNC_KEY = 'runnersway.healthSync'

export function loadLastSync(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SYNC_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function setLastSync(id: RunSource, iso: string) {
  const all = loadLastSync()
  all[id] = iso
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(all))
}
function clearLastSync(id: RunSource) {
  const all = loadLastSync()
  delete all[id]
  localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(all))
}

// ── 동기화 오케스트레이터 ──

/** 한 소스의 러닝을 가져와 건강 캐시에 병합(같은 소스는 교체) */
export async function syncSource(id: RunSource, nowIso: string): Promise<number> {
  const provider = getHealthProvider(id)
  const runs = await provider.fetchWorkouts({ limit: 50 })
  const others = loadHealthRuns().filter((r) => r.source !== id)
  saveHealthRuns([...runs, ...others])
  setLastSync(id, nowIso)
  return runs.length
}

/** 권한 요청 → 성공 시 즉시 동기화. 반환값으로 UI가 상태 처리 */
export async function connectSource(
  id: RunSource,
  nowIso: string,
): Promise<{ status: HealthAuthStatus; count: number }> {
  const provider = getHealthProvider(id)
  const status = await provider.requestAuthorization()
  if (status !== 'granted') return { status, count: 0 }
  const count = await syncSource(id, nowIso)
  return { status, count }
}

/** 연동 해제 — 캐시에서 해당 소스 기록과 동기화 시각 제거 */
export function disconnectSource(id: RunSource) {
  saveHealthRuns(loadHealthRuns().filter((r) => r.source !== id))
  clearLastSync(id)
}

/** 연결된 소스 전부 재동기화 */
export async function syncAll(connected: RunSource[], nowIso: string): Promise<number> {
  let total = 0
  for (const id of connected) total += await syncSource(id, nowIso)
  return total
}
