import type { Fix } from '../location'

/* ──────────────────────────────────────────────────────────────
   @capacitor/geolocation 어댑터 (iOS 백그라운드 GPS)

   네이티브(iOS 앱) 런타임에서만 호출된다. 웹에서는 location.ts의
   isNativePlatform()가 false이므로 실행되지 않는다. @capacitor/geolocation 은
   동적 import 라 웹 번들엔 별도 청크로만 들어간다.

   백그라운드(화면 끔/주머니) 지속 측정 조건 — IOS_SETUP.md 참고:
   - Info.plist: NSLocationWhenInUseUsageDescription +
     NSLocationAlwaysAndWhenInUseUsageDescription
   - Xcode Signing & Capabilities → Background Modes → "Location updates"
   - 사용자가 위치 권한을 "항상 허용"으로 부여
   위 조건이 갖춰지면 watchPosition 콜백이 백그라운드에서도 계속 들어온다.
   ────────────────────────────────────────────────────────────── */

/** 고정밀 위치 구독 시작 → 멈춤 함수 반환 */
export async function startWatch(
  onFix: (f: Fix) => void,
  onError: (msg: string) => void,
): Promise<() => void> {
  const { Geolocation } = await import('@capacitor/geolocation')

  // 백그라운드 측정을 위해 "항상 허용" 권한 요청. 거부/제한돼도 watch는 시도한다.
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted') {
      await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] })
    }
  } catch {
    /* 권한 API 실패는 무시 — watch가 자체적으로 오류를 보고한다 */
  }

  let watchId: string | null = null
  try {
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      (pos, err) => {
        if (err) {
          onError(err.message ?? 'GPS 신호를 받지 못했어요')
          return
        }
        if (!pos) return
        const c = pos.coords
        onFix({
          lat: c.latitude,
          lng: c.longitude,
          acc: c.accuracy ?? 999,
          alt: c.altitude ?? undefined,
          t: pos.timestamp,
        })
      },
    )
  } catch (e) {
    onError(e instanceof Error ? e.message : 'GPS를 시작하지 못했어요')
  }

  return () => {
    if (watchId) Geolocation.clearWatch({ id: watchId }).catch(() => {})
    watchId = null
  }
}
