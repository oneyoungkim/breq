export type Level = 'slow' | 'easy' | 'tempo' | 'racer'

export interface Profile {
  name: string
  region: string
  paceSec: number | null // null = 걷뛰 위주 or 아직 몰라요
  walkRun: boolean
  distances: string[]
  purposes: string[]
  styles: string[]
  level: Level
}

export interface Meetup {
  id: string
  title: string
  region: string
  spot: string
  dateLabel: string
  time: string
  distanceKm: number
  paceMin: number // 빠른 쪽(초/km, 작은 값)
  paceMax: number // 느린 쪽(초/km, 큰 값)
  max: number
  members: string[]
  host: string
  hostLevel: Level
  beginnerOk: boolean
  quiet: boolean
  noDrop: boolean // 뒤처짐 없는 런
  night: boolean // 야간 안전 모드
  certRequired: boolean
  desc: string
  course: string
}

export interface CrewMember {
  name: string
  level: Level
  attendRate: number
}

export interface Notice {
  id: string
  date: string
  text: string
  pinned?: boolean
}

export interface ScheduleItem {
  id: string
  title: string
  dayTime: string
  spot: string
  pace: string
}

export interface Crew {
  name: string
  region: string
  intro: string
  members: CrewMember[]
  notices: Notice[]
  schedule: ScheduleItem[]
}

export interface RunInput {
  distanceKm: number
  minutes: number
  seconds: number
  mood: string
  weather: string
  courseName: string
  shoe: string
  withCrew: boolean
  walkRun: boolean
  // 인증카드 고도화용 옵션 필드 (기록 선택 시 자동 채움 / 카드 단계에서 라벨 편집)
  source?: RunSource // 측정 소스(앱/애플/가민…) — 인증카드 검증 배지용
  track?: GeoPoint[]
  splits?: number[]
  avgHr?: number
  cadence?: number
  crewName?: string
  crewMembers?: number
  isPB?: boolean
  pbKind?: string
}

export type CertTemplate =
  | 'minimal' // Minimal Data
  | 'route' // Route Focus
  | 'photo' // Photo Overlay
  | 'pride' // Slow Runner Pride
  | 'crew' // Crew Run
  | 'race' // Race Mode
  | 'monthly' // 월간 누적 마일리지 (PRO 전용)
  | 'profile' // 러너 프로필 / 커리어 스탯 (PRO 전용)
  | 'stamps' // 코스 도장깨기 (PRO 전용)
  | 'records' // 개인 기록실 / PB 보드 (PRO 전용)
  | 'streak' // 이달의 러닝 캘린더 / 스트릭 (PRO 전용)

export type CardTheme = 'light' | 'dark' | 'blue' | 'photo'

export type CardRatio = 'story' | 'feed' // 9:16 / 4:5

// ── AI 코치가 참고하는 러너 정보 (전부 선택 입력) ──
export type AgeBand = '10s' | '20s' | '30s' | '40s' | '50s' | '60+'
export type RunExperience = 'new' | 'under1y' | '1to3y' | 'over3y'

export interface AthleteInfo {
  ageBand?: AgeBand
  heightCm?: number
  weightKg?: number
  experience?: RunExperience
  injuries?: string[]
  injuryNote?: string
  mainGoal?: string
  weeklyTarget?: number // 주당 가능 러닝 횟수
}

export type GoalType = 'habit' | '5k' | '10k' | 'half' | 'pb'

export interface Goal {
  type: GoalType
  weeks: number
  daysPerWeek: number
}

export interface Workout {
  day: string
  kind: string
  title: string
  detail: string
}

export interface PlanWeek {
  week: number
  focus: string
  workouts: Workout[]
}

export type RunSource = 'app' | 'apple' | 'garmin' | 'nike' | 'strava'

/** GPS 트랙 한 점 */
export interface GeoPoint {
  lat: number
  lng: number
  t: number // epoch ms
  acc?: number // 위치 정확도(m)
  alt?: number // 고도(m)
  brk?: boolean // 일시정지 후 재개 지점 — 이전 점과 잇지 않음(거리·경로 분절)
}

export interface RunRecord {
  id: string
  source: RunSource
  dateLabel: string
  startTime: string
  distanceKm: number
  durationSec: number
  splits: number[] // km별 구간 기록(초)
  avgHr?: number
  cadence?: number
  course?: string
  memo?: string
  track?: GeoPoint[] // 실제 GPS 경로 (지도/경로 렌더용)
  // HealthKit(HKWorkout) 매핑용 — 워치 연동 시 채워짐 (전부 선택)
  startedAt?: string // ISO
  endedAt?: string // ISO
  energyKcal?: number
  elevationGainM?: number
}
