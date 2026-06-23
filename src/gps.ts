import type { GeoPoint } from './types'

/** 두 좌표 사이 거리(m) — Haversine */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * GPS 1차원 칼만 필터 (위·경도 동시 추정).
 *
 * 측정 정확도(accuracy, m)를 관측 노이즈로, 추정 이동량(Q m/s)을 프로세스 노이즈로
 * 사용해 제자리 흔들림(지터)과 지그재그를 억제한다. 이것이 거리 과다 계상(보통
 * 원시 누적 대비 5~10% 부풀려짐)을 막는 핵심이다.
 *
 * 표준 GPS smoothing 칼만 구현을 기반으로 한다.
 */
export class GpsKalman {
  private q: number // 프로세스 노이즈 (m/s) — 러닝 ≈ 3
  private variance = -1 // 추정 분산 P (음수 = 미초기화)
  private t = 0 // 마지막 측정 시각(ms)
  lat = 0
  lng = 0

  constructor(qMetresPerSecond = 3) {
    this.q = qMetresPerSecond
  }

  /** 현재 추정 위치 정확도(m, 표준편차) */
  get accuracy() {
    return this.variance < 0 ? Infinity : Math.sqrt(this.variance)
  }

  get ready() {
    return this.variance >= 0
  }

  reset() {
    this.variance = -1
  }

  /** 새 측정 반영 후 보정된 위치를 반환 */
  process(lat: number, lng: number, accuracy: number, tMs: number): { lat: number; lng: number } {
    const acc = Math.max(accuracy, 1) // 1m 미만 정확도는 신뢰 과대 → 하한
    if (this.variance < 0) {
      // 초기화
      this.t = tMs
      this.lat = lat
      this.lng = lng
      this.variance = acc * acc
    } else {
      // 예측: 시간이 흐른 만큼 불확실성 증가
      const dt = (tMs - this.t) / 1000
      if (dt > 0) {
        this.variance += dt * this.q * this.q
        this.t = tMs
      }
      // 보정: 칼만 이득 K로 측정과 추정을 가중 평균
      const k = this.variance / (this.variance + acc * acc)
      this.lat += k * (lat - this.lat)
      this.lng += k * (lng - this.lng)
      this.variance = (1 - k) * this.variance
    }
    return { lat: this.lat, lng: this.lng }
  }
}

/** 누적 트랙으로 총 거리(km) 재계산 — 저장 직전 검증용. 분절(brk) 구간은 건너뜀 */
export function trackDistanceKm(track: GeoPoint[]): number {
  let m = 0
  for (let i = 1; i < track.length; i++) {
    if (track[i].brk) continue // 일시정지 갭은 거리에 포함하지 않음
    m += haversine(track[i - 1].lat, track[i - 1].lng, track[i].lat, track[i].lng)
  }
  return m / 1000
}
