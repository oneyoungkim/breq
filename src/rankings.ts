import type { Level } from './types'
import { allRecentRuns } from './runs'

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

// ── 내 실제 기록 통계 (앱 + 워치/연동 기록 모두 포함) ──
export interface MyStats {
  mileageKm: number
  best5kSec: number | null
  best10kSec: number | null
  runCount: number
}

/** allRecentRuns(앱런 + 건강/연동 캐시)에서 내 통계를 산출 */
export function myStats(): MyStats {
  const runs = allRecentRuns().filter((r) => r.distanceKm > 0 && r.durationSec > 0)
  const mileageKm = runs.reduce((s, r) => s + r.distanceKm, 0)
  const bestPace = (minKm: number): number | null => {
    const cand = runs.filter((r) => r.distanceKm >= minKm)
    if (!cand.length) return null
    return Math.min(...cand.map((r) => r.durationSec / r.distanceKm))
  }
  const p5 = bestPace(4.8) // 5K 근접 이상 기록
  const p10 = bestPace(9.6)
  return {
    mileageKm,
    best5kSec: p5 == null ? null : Math.round(p5 * 5),
    best10kSec: p10 == null ? null : Math.round(p10 * 10),
    runCount: runs.length,
  }
}

const parseKm = (s: string) => parseFloat(s) || 0
const parseTime = (s: string) => {
  const p = s.split(':').map(Number)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p[0] || 0) * 60 + (p[1] || 0)
}
const fmtKm = (km: number) => `${km.toFixed(1)}km`
const fmtTime = (sec: number) => {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`
}

/** 카테고리별 내 실제 값 (없으면 null → 해당 랭킹에서 내 행 제외) */
function myValueFor(cat: RankCategory): string | null {
  const s = myStats()
  if (cat === 'mileage') return s.runCount ? fmtKm(s.mileageKm) : null
  if (cat === 'pace5') return s.best5kSec != null ? fmtTime(s.best5kSec) : null
  if (cat === 'pace10') return s.best10kSec != null ? fmtTime(s.best10kSec) : null
  return null // goal은 플랜 달성률이라 별도(목업 유지)
}

export function getRanking(
  scope: RankScope,
  cat: RankCategory,
  myName: string,
): RankEntry[] {
  const table = (scope === 'app' ? APP[cat] : (CREW[cat] ?? [])).filter(
    ([name]) => name !== myName, // 내 닉네임과 겹치는 목업 행 제거
  )
  const myValue = myValueFor(cat)

  // goal(플랜 달성률) 또는 산출 불가 시 — 기존 정적 동작 유지.
  // 단 산출 불가한 페이스 카테고리는 가짜 내 기록을 보이지 않도록 내 행 제외.
  if (myValue == null) {
    return table
      .filter(([name]) => !(name === ME && cat !== 'goal'))
      .map(([name, level, value]) =>
        name === ME ? { name: myName, level, value, me: true } : { name, level, value },
      )
  }

  // 내 실제 값으로 교체 후, 값 기준 재정렬(마일리지=내림차순, 페이스=오름차순)
  const asc = cat !== 'mileage'
  const rows = table.map(([name, level, value]) => {
    const me = name === ME
    const v = me ? myValue : value
    return {
      name: me ? myName : name,
      level,
      value: v,
      me,
      num: cat === 'mileage' ? parseKm(v) : parseTime(v),
    }
  })
  rows.sort((a, b) => (asc ? a.num - b.num : b.num - a.num))
  return rows.map(({ name, level, value, me }) => ({ name, level, value, me }))
}

const PACE_RANK_KEY = 'runnersway.crewPaceRank'

/** 크루장 설정: 페이스 랭킹 숨김 여부 (슬로우러너 크루 배려) */
export function crewPaceHidden(): boolean {
  return (localStorage.getItem(PACE_RANK_KEY) ?? 'hidden') === 'hidden'
}

export function setCrewPaceHidden(hidden: boolean) {
  localStorage.setItem(PACE_RANK_KEY, hidden ? 'hidden' : 'shown')
}
