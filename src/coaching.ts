import type { Goal, GoalType, Level, PlanWeek, Workout } from './types'
import { fmtPace } from './logic'

export const GOAL_META: Record<
  GoalType,
  { label: string; code: string; weeks: number; desc: string; forLevels: Level[] }
> = {
  habit: {
    label: '꾸준한 러닝 습관',
    code: 'BASE',
    weeks: 4,
    desc: '기록 부담 없이 출석이 목표. 걷뛰로 가볍게 시작해요.',
    forLevels: ['slow', 'easy'],
  },
  '5k': {
    label: '5K 완주',
    code: '5K',
    weeks: 4,
    desc: '4주 뒤, 멈추지 않고 5km를 달려요.',
    forLevels: ['slow', 'easy'],
  },
  '10k': {
    label: '10K 도전',
    code: '10K',
    weeks: 8,
    desc: '8주 동안 거리를 차근차근 12km까지 늘려요.',
    forLevels: ['easy', 'tempo'],
  },
  half: {
    label: '첫 하프마라톤',
    code: '21K',
    weeks: 12,
    desc: '12주 롱런 빌드업으로 21.1km까지.',
    forLevels: ['tempo', 'racer'],
  },
  pb: {
    label: '10K 기록 단축',
    code: 'PB',
    weeks: 6,
    desc: '인터벌과 템포런으로 PB를 깨요.',
    forLevels: ['tempo', 'racer'],
  },
}

export const INTEGRATIONS = [
  { id: 'apple', name: 'Apple 건강 · 운동', icon: 'APL', desc: '아이폰·애플워치 러닝 자동 동기화' },
  { id: 'garmin', name: 'Garmin Connect', icon: 'GRM', desc: '가민 워치 기록 가져오기' },
  { id: 'nike', name: 'Nike Run Club', icon: 'NRC', desc: 'NRC 러닝 기록 가져오기' },
  { id: 'strava', name: 'Strava', icon: 'STR', desc: '활동 자동 공유 · 가져오기' },
]

const DAY_SLOTS: Record<number, string[]> = {
  2: ['화', '토'],
  3: ['월', '수', '토'],
  4: ['월', '수', '금', '일'],
  5: ['월', '화', '목', '금', '일'],
}

type Wo = Omit<Workout, 'day'>

export function generatePlan(
  goal: Goal,
  level: Level,
  paceSec: number | null,
): PlanWeek[] {
  const days = DAY_SLOTS[goal.daysPerWeek] ?? DAY_SLOTS[3]
  const n = days.length
  const walkish = level === 'slow'
  const easyPace = paceSec ? `${fmtPace(paceSec + 40)}/km` : '편안한 속도'
  const tempoPace = paceSec ? `${fmtPace(Math.max(paceSec - 20, 240))}/km` : '약간 힘든 속도'
  const itvPace = paceSec ? `${fmtPace(Math.max(paceSec - 45, 220))}/km` : '빠른 속도'

  const easyRun = (min: number): Wo =>
    walkish
      ? { kind: '걷뛰', title: `걷뛰 ${min}분`, detail: '1분 뛰고 1분 걷기 반복 · 숨차면 더 걸어도 괜찮아요' }
      : { kind: '이지런', title: `이지런 ${min}분`, detail: `${easyPace} · 대화가 가능한 편안한 강도` }

  const recovery = (min: number): Wo => ({
    kind: '회복런',
    title: `회복런 ${min}분`,
    detail: `${easyPace}보다 더 천천히 · 다리 풀어주기`,
  })

  const interval = (reps: number): Wo => ({
    kind: '인터벌',
    title: `인터벌 400m × ${reps}`,
    detail: `${itvPace}로 400m + 200m 천천히 회복 조깅`,
  })

  const tempo = (min: number): Wo => ({
    kind: '템포런',
    title: `템포런 ${min}분`,
    detail: `${tempoPace} · "말은 가능하지만 수다는 무리" 강도 유지`,
  })

  const longRun = (km: number): Wo => ({
    kind: '롱런',
    title: `롱런 ${km}km`,
    detail: `${easyPace} · 거리에 몸을 적응시키는 게 목적, 천천히`,
  })

  const out: PlanWeek[] = []
  for (let w = 1; w <= goal.weeks; w++) {
    const last = w === goal.weeks
    const taper = goal.weeks >= 6 && w === goal.weeks - 1
    let slots: Wo[] = []

    if (goal.type === 'habit') {
      const min = 16 + 4 * w
      slots = Array.from({ length: n }, () => easyRun(min))
      slots[n - 1] = last
        ? walkish
          ? { kind: '챌린지', title: '걷뛰 40분 채우기', detail: '마지막 주 도전! 시간만 채우면 성공이에요' }
          : { kind: '챌린지', title: '30분 논스톱 러닝', detail: '걷지 않고 30분 — 페이스는 아무래도 좋아요' }
        : easyRun(min + 10)
    }

    if (goal.type === '5k') {
      const runMin = [1, 3, 5, 10][w - 1] ?? 10
      const sets = [8, 5, 4, 2][w - 1] ?? 2
      slots = [
        {
          kind: '걷뛰',
          title: `뛰기 ${runMin}분 + 걷기 1분 × ${sets}`,
          detail: '뛰는 구간을 조금씩 늘리는 게 핵심이에요',
        },
        ...Array.from({ length: Math.max(n - 2, 0) }, () => easyRun(20 + 5 * w)),
        last
          ? { kind: '챌린지', title: '5K 완주 도전', detail: '멈추지 않고 5km — 페이스는 잊고 완주만 생각해요' }
          : longRun(Math.round((2 + 0.8 * w) * 10) / 10),
      ]
    }

    if (goal.type === '10k') {
      slots = [
        w <= 4 ? interval(4 + w) : tempo(15 + 2 * w),
        ...Array.from({ length: Math.max(n - 2, 0) }, () => easyRun(30 + 2 * w)),
        last
          ? { kind: '챌린지', title: '10K 도전 런', detail: '지금까지의 빌드업을 믿고 완주해요' }
          : longRun(taper ? 6 : Math.min(4 + w, 12)),
      ]
    }

    if (goal.type === 'half') {
      slots = [
        tempo(20 + w),
        ...Array.from({ length: Math.max(n - 2, 0) }, () => easyRun(40)),
        last
          ? { kind: '챌린지', title: '하프 21.1km 완주', detail: '초반 5km는 답답할 만큼 천천히 — 후반을 위한 저금이에요' }
          : longRun(taper ? 10 : Math.min(7 + w, 18)),
      ]
    }

    if (goal.type === 'pb') {
      const mid: Wo[] =
        n >= 4
          ? [tempo(20 + 2 * w), ...Array.from({ length: n - 3 }, () => recovery(30))]
          : Array.from({ length: Math.max(n - 2, 0) }, () => recovery(30))
      slots = [
        interval(6 + w),
        ...mid,
        last
          ? { kind: '챌린지', title: '10K 타임트라이얼', detail: 'PB 도전! 전반 5km는 목표 페이스 유지, 후반 승부' }
          : longRun(taper ? 6 : Math.min(7 + w, 12)),
      ]
    }

    slots = slots.slice(0, n)
    while (slots.length < n) slots.splice(1, 0, easyRun(25))

    out.push({
      week: w,
      focus: last
        ? '도전 주간'
        : taper
          ? '테이퍼링 — 줄여야 늘어요'
          : w === 1
            ? '몸 적응 주간'
            : w <= goal.weeks / 2
              ? '기초 쌓기'
              : '강도 올리기',
      workouts: slots.map((s, i) => ({ ...s, day: days[i] })),
    })
  }
  return out
}
