import type { Level } from './types'

export type RankCategory = 'mileage' | 'pace5' | 'pace10' | 'goal'
export type RankScope = 'app' | 'crew'

export interface RankEntry {
  name: string
  level: Level
  value: string
  me?: boolean
}

export const CATEGORY_META: Record<RankCategory, { label: string; desc: string }> = {
  mileage: { label: '마일리지', desc: '이번 달 누적 거리 기준' },
  pace5: { label: '5K 기록', desc: '가장 빠른 5km 완주 기록' },
  pace10: { label: '10K 기록', desc: '가장 빠른 10km 완주 기록' },
  goal: {
    label: '목표 달성',
    desc: 'BREQ 코칭 플랜 달성률 기준 — 페이스가 느려도 1위가 될 수 있어요',
  },
}

type Row = [string, Level, string]
const ME = '__ME__'

const APP: Record<RankCategory, Row[]> = {
  mileage: [
    ['서브3가즈아', 'racer', '142.3km'],
    ['하프준비중', 'racer', '118.6km'],
    ['페이스메이커K', 'tempo', '97.4km'],
    ['트랙중독', 'racer', '88.1km'],
    ['한강치타', 'tempo', '74.9km'],
    [ME, 'easy', '42.0km'],
    ['뛰고라떼', 'easy', '38.2km'],
    ['호수러너', 'slow', '31.5km'],
    ['노을수집가', 'slow', '27.8km'],
    ['오늘부터시작', 'slow', '19.4km'],
  ],
  pace5: [
    ['서브3가즈아', 'racer', '18:42'],
    ['트랙중독', 'racer', '19:25'],
    ['PB사냥꾼', 'racer', '19:58'],
    ['페이스메이커K', 'tempo', '21:10'],
    ['한강치타', 'tempo', '22:03'],
    ['금요질주', 'tempo', '23:41'],
    ['새벽반장', 'easy', '27:30'],
    [ME, 'easy', '31:05'],
    ['뛰고라떼', 'easy', '33:20'],
    ['호수러너', 'slow', '38:15'],
  ],
  pace10: [
    ['서브3가즈아', 'racer', '39:51'],
    ['하프준비중', 'racer', '42:18'],
    ['PB사냥꾼', 'racer', '43:05'],
    ['페이스메이커K', 'tempo', '45:22'],
    ['10K전문', 'tempo', '47:10'],
    ['장거리체질', 'racer', '49:33'],
    ['한강치타', 'tempo', '51:08'],
    ['금요질주', 'tempo', '54:46'],
    [ME, 'easy', '1:04:50'],
    ['뛰고라떼', 'easy', '1:09:12'],
  ],
  goal: [
    ['말랑발바닥', 'slow', '96%'],
    ['오늘부터시작', 'slow', '94%'],
    ['하프준비중', 'racer', '91%'],
    ['커피전에한바퀴', 'easy', '88%'],
    ['노을수집가', 'slow', '83%'],
    ['페이스메이커K', 'tempo', '76%'],
    [ME, 'easy', '67%'],
    ['뛰고라떼', 'easy', '61%'],
    ['한강치타', 'tempo', '48%'],
    ['서브3가즈아', 'racer', '40%'],
  ],
}

const CREW: Partial<Record<RankCategory, Row[]>> = {
  mileage: [
    ['새벽반장', 'easy', '58.2km'],
    ['한강갈매기', 'tempo', '51.7km'],
    ['아침형러너', 'tempo', '44.9km'],
    [ME, 'easy', '42.0km'],
    ['달리는수박', 'slow', '38.5km'],
    ['러닝하는직장인', 'easy', '30.1km'],
    ['말랑발바닥', 'slow', '26.4km'],
    ['커피전에한바퀴', 'easy', '22.0km'],
  ],
  pace5: [
    ['한강갈매기', 'tempo', '22:40'],
    ['아침형러너', 'tempo', '23:55'],
    ['새벽반장', 'easy', '27:30'],
    [ME, 'easy', '31:05'],
    ['러닝하는직장인', 'easy', '32:10'],
    ['커피전에한바퀴', 'easy', '34:02'],
    ['달리는수박', 'slow', '35:48'],
    ['말랑발바닥', 'slow', '38:15'],
  ],
  goal: [
    ['말랑발바닥', 'slow', '96%'],
    ['새벽반장', 'easy', '89%'],
    ['커피전에한바퀴', 'easy', '88%'],
    ['달리는수박', 'slow', '79%'],
    [ME, 'easy', '67%'],
    ['러닝하는직장인', 'easy', '55%'],
    ['아침형러너', 'tempo', '51%'],
    ['한강갈매기', 'tempo', '43%'],
  ],
}

export function getRanking(
  scope: RankScope,
  cat: RankCategory,
  myName: string,
): RankEntry[] {
  const table = scope === 'app' ? APP[cat] : (CREW[cat] ?? [])
  return table
    .filter(([name]) => name !== myName) // 내 닉네임과 겹치는 목업 행 제거
    .map(([name, level, value]) =>
      name === ME
        ? { name: myName, level, value, me: true }
        : { name, level, value },
    )
}

const PACE_RANK_KEY = 'runnersway.crewPaceRank'

/** 크루장 설정: 페이스 랭킹 숨김 여부 (슬로우러너 크루 배려) */
export function crewPaceHidden(): boolean {
  return (localStorage.getItem(PACE_RANK_KEY) ?? 'hidden') === 'hidden'
}

export function setCrewPaceHidden(hidden: boolean) {
  localStorage.setItem(PACE_RANK_KEY, hidden ? 'hidden' : 'shown')
}
