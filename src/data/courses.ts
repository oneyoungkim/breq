/* ──────────────────────────────────────────────────────────────
   BREQ 추천 코스 시드 (큐레이션)

   잘 알려진 공개 러닝 코스를 일반 상식 기반으로 직접 큐레이션한 목록.
   거리·추천 페이스·예상 시간은 모두 BREQ 자체 추정값(외부 사이트 수치 복제 아님).
   - distanceKm: 근사치 (추후 OSM/공공데이터로 실측 보정 예정)
   - paceSec: 권장 이지 페이스(초/km). UI에서 예상 시간 = distance × pace
   - terrain: flat(평지/강변) | park(공원·롤링) | hill(언덕) | loop(짧은 순환)
   - track: 아직 없음. P2에서 OSM/공공데이터로 실제 경로 좌표 부착 예정
   ────────────────────────────────────────────────────────────── */

export type CourseTerrain = 'flat' | 'park' | 'hill' | 'loop'

export interface Course {
  id: string
  name: string
  area: string // 표시용 지역
  distanceKm: number
  paceSec: number // 권장 이지 페이스(초/km)
  terrain: CourseTerrain
  note: string // 한 줄 특징
}

export const TERRAIN_LABEL: Record<CourseTerrain, string> = {
  flat: '평지·강변',
  park: '공원·완만',
  hill: '언덕',
  loop: '짧은 순환',
}

/** 예상 시간(초) = 거리 × 페이스 */
export function courseTimeSec(c: Course): number {
  return Math.round(c.distanceKm * c.paceSec)
}

export const COURSES: Course[] = [
  { id: 'banpo-hangang', name: '반포한강공원 잠수교 코스', area: '서초 반포', distanceKm: 6.0, paceSec: 360, terrain: 'flat', note: '잠수교 왕복, 야경·분수 구간' },
  { id: 'yeouido-hangang', name: '여의도한강공원 코스', area: '영등포 여의도', distanceKm: 8.0, paceSec: 355, terrain: 'flat', note: '넓고 평탄, 초보·기록 모두 적합' },
  { id: 'ttukseom-hangang', name: '뚝섬한강공원 코스', area: '광진 자양', distanceKm: 5.0, paceSec: 360, terrain: 'flat', note: '한강숲·물놀이장 옆 평지' },
  { id: 'jamsil-hangang', name: '잠실한강공원 코스', area: '송파 잠실', distanceKm: 7.0, paceSec: 360, terrain: 'flat', note: '잠실대교~올림픽대교 강변' },
  { id: 'namsan-loop', name: '남산 북측순환로', area: '중구 남산', distanceKm: 7.0, paceSec: 405, terrain: 'hill', note: '오르막 포함, 심폐·언덕 훈련' },
  { id: 'olympic-park', name: '올림픽공원 몽촌토성 둘레', area: '송파 방이', distanceKm: 5.0, paceSec: 375, terrain: 'park', note: '완만한 굴곡, 나무 그늘' },
  { id: 'seoul-forest', name: '서울숲 코스', area: '성동 성수', distanceKm: 3.0, paceSec: 365, terrain: 'park', note: '짧고 평탄, 산책 겸 가볍게' },
  { id: 'cheonggyecheon', name: '청계천 하류 코스', area: '종로~성동', distanceKm: 5.8, paceSec: 370, terrain: 'flat', note: '도심 하천, 신호 없는 직선' },
  { id: 'anyangcheon', name: '안양천 코스', area: '구로~양천', distanceKm: 10.0, paceSec: 355, terrain: 'flat', note: '길고 평탄, 롱런·LSD 적합' },
  { id: 'tancheon', name: '탄천 코스', area: '분당~송파', distanceKm: 8.0, paceSec: 355, terrain: 'flat', note: '강변 자전거길 옆, 거리 조절 쉬움' },
  { id: 'yangjaecheon', name: '양재천 코스', area: '서초~강남', distanceKm: 6.0, paceSec: 360, terrain: 'flat', note: '벚꽃·억새 시즌 인기' },
  { id: 'gyeongui-forest', name: '경의선숲길', area: '마포 연남~공덕', distanceKm: 4.0, paceSec: 375, terrain: 'park', note: '도심 선형 공원, 구간별 분위기' },
  { id: 'seokchon-lake', name: '석촌호수 순환', area: '송파 잠실', distanceKm: 2.5, paceSec: 360, terrain: 'loop', note: '한 바퀴 약 2.5km, 짧은 반복' },
  { id: 'dream-forest', name: '북서울꿈의숲', area: '강북 번동', distanceKm: 3.0, paceSec: 375, terrain: 'park', note: '숲·언덕 살짝, 조용한 코스' },
]
