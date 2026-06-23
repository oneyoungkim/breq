/* ──────────────────────────────────────────────────────────────
   BREQ 위치(GPS) 프로바이더

   목표: 러닝 트래커가 "위치 한 점이 들어온다"는 계약(LocationProvider)에만
   의존하게 만든다. 웹/Windows에서는 navigator.geolocation(포그라운드)만
   동작하고, iOS 네이티브 빌드에서는 @capacitor/geolocation 으로 갈아끼워
   화면을 끄거나 주머니에 넣은 백그라운드 러닝까지 측정한다.

   칼만 필터·거리 게이트 등 정밀화 파이프라인은 트래커(RunTracker)가 들고
   있고, 이 모듈은 "원시 fix 스트림"만 책임진다.

   교체 지점:
   - getLocationProvider(): 네이티브면 NativeLocationProvider, 아니면 Web
   - src/native/geolocation.ts 의 startWatch (백그라운드 권한/모드)
   ────────────────────────────────────────────────────────────── */

/** 정규화된 위치 한 점 */
export interface Fix {
  lat: number
  lng: number
  acc: number // 위치 정확도(m)
  alt?: number // 고도(m)
  t: number // epoch ms
}

/** 실행 중인 위치 구독 — 멈추려면 stop() */
export interface LocationWatch {
  stop(): void
}

export interface LocationProvider {
  /** 네이티브 컨테이너(백그라운드 지속 가능)인지 */
  readonly isNative: boolean
  /** 고정밀 위치 스트림 시작 */
  watch(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<LocationWatch>
}

/** Capacitor 네이티브(iOS 앱) 런타임인지 */
export function isNativePlatform(): boolean {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform())
}

/** 웹/프로토타입 — 브라우저 Geolocation. 화면 켠 포그라운드에서만 측정됨. */
class WebLocationProvider implements LocationProvider {
  readonly isNative = false
  async watch(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<LocationWatch> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      onError('이 기기에서 GPS를 쓸 수 없어요')
      return { stop() {} }
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords
        onFix({
          lat: c.latitude,
          lng: c.longitude,
          acc: c.accuracy ?? 999,
          alt: c.altitude ?? undefined,
          t: pos.timestamp,
        })
      },
      (err) => onError(err.message || 'GPS 신호를 받지 못했어요'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
    return { stop: () => navigator.geolocation.clearWatch(id) }
  }
}

/** iOS 네이티브 — @capacitor/geolocation 어댑터(src/native/geolocation.ts)로 위임.
 *  웹에서는 호출되지 않으며, 어댑터는 @capacitor/geolocation 을 동적 import 한다. */
class NativeLocationProvider implements LocationProvider {
  readonly isNative = true
  async watch(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<LocationWatch> {
    const { startWatch } = await import('./native/geolocation')
    const stop = await startWatch(onFix, onError)
    return { stop }
  }
}

export function getLocationProvider(): LocationProvider {
  return isNativePlatform() ? new NativeLocationProvider() : new WebLocationProvider()
}
