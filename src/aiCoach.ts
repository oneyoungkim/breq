import type { AthleteInfo, Goal, Level, Profile, RunRecord } from './types'
import { fmtPace } from './logic'

/* ──────────────────────────────────────────────────────────────
   BREQ AI Coach (목업)

   설계 의도: 지금은 규칙 기반 목업이지만, 화면이 의존하는 것은 오직
   `CoachContext`(입력)와 `RunReview`(출력) 두 계약뿐이다.
   나중에 실제 LLM으로 바꿀 때는 reviewRun()의 "몸통"만 교체하면 된다.
   (아래 buildCoachPrompt / fetchCoachReview 참고)
   ────────────────────────────────────────────────────────────── */

const GOAL_KEY = 'runnersway.goal'
const ATHLETE_KEY = 'runnersway.athlete'
const PRO_KEY = 'runnersway.pro'

export function loadAthlete(): AthleteInfo {
  try {
    return JSON.parse(localStorage.getItem(ATHLETE_KEY) ?? '{}') as AthleteInfo
  } catch {
    return {}
  }
}
export function saveAthlete(a: AthleteInfo) {
  localStorage.setItem(ATHLETE_KEY, JSON.stringify(a))
}
export function loadGoal(): Goal | null {
  try {
    const raw = localStorage.getItem(GOAL_KEY)
    return raw ? (JSON.parse(raw) as Goal) : null
  } catch {
    return null
  }
}
export function isPro(): boolean {
  return localStorage.getItem(PRO_KEY) === '1'
}

// ── 계약 ──────────────────────────────────────────────────────
export interface CoachContext {
  profile: Profile
  athlete: AthleteInfo
  goal: Goal | null
  run: RunRecord
  recentRuns: RunRecord[]
}

export interface CoachSignals {
  weeklyKm: number
  loadSpike: boolean
  negativeSplit: boolean
  lastKmHeld: boolean
  positiveBlowup: boolean
  paceVsUsual: 'faster' | 'slower' | 'steady' | 'unknown'
  deltaSec: number // 이번 페이스 - 평소 페이스 (음수 = 빠름)
  runCount: number
}

export interface RunReview {
  headline: string // 핵심 해석 한 줄
  summary: string // 사실 기반 한 줄 (무료)
  good: string[] // 좋은 점
  watch: string[] // 주의할 점 (성능 관점 — Pro)
  next: string // 다음 러닝 추천
  certLine: string // 인증카드용 한 줄
  safetyNote?: string // 안전/회복 관련 (항상 무료로 노출)
  tone: 'care' | 'perform'
  signals: CoachSignals
}

// ── 컨텍스트 빌더 (localStorage에서 목표·러너정보 로드) ──
export function buildContext(
  profile: Profile,
  run: RunRecord,
  recentRuns: RunRecord[],
): CoachContext {
  return { profile, athlete: loadAthlete(), goal: loadGoal(), run, recentRuns }
}

// ── 유틸 ──
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const round1 = (n: number) => Math.round(n * 10) / 10
function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

const INJURY_LABEL: Record<string, string> = {
  knee: '무릎',
  ankle: '발목',
  hip: '고관절',
  shin: '정강이',
  calf: '종아리',
  back: '허리',
  plantar: '족저근막',
  hamstring: '햄스트링',
}

function careTone(level: Level, walkRun: boolean) {
  return walkRun || level === 'slow' || level === 'easy'
}

// ── 신호 계산 ──
function computeSignals(ctx: CoachContext): CoachSignals {
  const { run, recentRuns, profile } = ctx
  const idx = recentRuns.findIndex((r) => r.id === run.id)
  const prev = (idx >= 0 ? recentRuns.slice(idx + 1) : recentRuns.filter((r) => r.id !== run.id))
  const prev3 = prev.slice(0, 3)
  const prevAvgKm = mean(prev3.map((r) => r.distanceKm))
  const loadSpike = prevAvgKm > 0 && run.distanceKm > prevAvgKm * 1.6
  // 주간 누적은 근사치(최근 ~4회 합)로 본다 — dateLabel이 자유 텍스트라 정밀 집계 대신 사용
  const weeklyKm = round1([run, ...prev.slice(0, 3)].reduce((s, r) => s + r.distanceKm, 0))

  const runPace = run.distanceKm > 0 ? run.durationSec / run.distanceKm : 0
  const prevPaces = prev.map((r) => (r.distanceKm > 0 ? r.durationSec / r.distanceKm : 0)).filter(Boolean)
  const usualPace = profile.paceSec ?? (prevPaces.length ? prevPaces.sort((a, b) => a - b)[Math.floor(prevPaces.length / 2)] : null)
  const deltaSec = usualPace ? runPace - usualPace : 0
  const paceVsUsual: CoachSignals['paceVsUsual'] = !usualPace
    ? 'unknown'
    : deltaSec <= -8
      ? 'faster'
      : deltaSec >= 8
        ? 'slower'
        : 'steady'

  const sp = run.splits ?? []
  let negativeSplit = false
  let lastKmHeld = true
  let positiveBlowup = false
  if (sp.length >= 2) {
    const avg = mean(sp)
    const h = Math.floor(sp.length / 2)
    const fh = mean(sp.slice(0, h))
    const sh = mean(sp.slice(h))
    negativeSplit = sh < fh * 0.99
    const lastKm = sp[sp.length - 1]
    lastKmHeld = lastKm <= avg * 1.06
    positiveBlowup = lastKm > avg * 1.12
  }

  return {
    weeklyKm,
    loadSpike,
    negativeSplit,
    lastKmHeld,
    positiveBlowup,
    paceVsUsual,
    deltaSec,
    runCount: recentRuns.length,
  }
}

// ── 추천 페이스 (다음 러닝 문구용) ──
function paces(profile: Profile) {
  const p = profile.paceSec
  return {
    easy: p ? `${fmtPace(p + 40)}/km` : '편안한 속도',
    tempo: p ? `${fmtPace(Math.max(p - 20, 240))}/km` : '약간 힘든 속도',
    itv: p ? `${fmtPace(Math.max(p - 45, 220))}/km` : '빠른 속도',
  }
}

/**
 * 러닝 1개를 해석한다. (목업)
 * 실제 AI로 교체 시: 이 함수 본문을 fetchCoachReview(ctx) 호출로 바꾸면 된다.
 */
export function reviewRun(ctx: CoachContext): RunReview {
  const { profile, athlete, goal, run } = ctx
  const s = computeSignals(ctx)
  const seed = hash(run.id)
  const care = careTone(profile.level, profile.walkRun)
  const tone: RunReview['tone'] = care ? 'care' : 'perform'
  const km = round1(run.distanceKm)
  const pace = run.distanceKm > 0 ? fmtPace(run.durationSec / run.distanceKm) : '--'
  const pc = paces(profile)

  // ── headline (핵심 해석) ──
  let headline: string
  if (s.loadSpike) {
    headline = care
      ? '이번 주, 몸이 꽤 일했어요. 다음은 회복이 먼저예요.'
      : '이번 주 거리가 확 늘었어요. 다음 러닝은 회복부터요.'
  } else if (care) {
    headline = profile.walkRun || goal?.type === 'habit'
      ? pick(
          ['빠른 날이 아니라, 다시 나온 날이에요.', '페이스보다 중요한 건 출발했다는 사실. 오늘 그걸 해냈어요.'],
          seed,
        )
      : s.lastKmHeld
        ? '끝까지 리듬이 무너지지 않았어요.'
        : '오늘은 기록보다 꾸준함을 챙긴 날이에요.'
  } else if (s.negativeSplit) {
    headline = '후반에 더 밀어붙였어요. 오늘은 잘 컨트롤한 날이에요.'
  } else if (s.paceVsUsual === 'slower') {
    headline = '오늘은 기록을 당긴 날이라기보다, 리듬을 되찾은 날이에요.'
  } else if (s.paceVsUsual === 'faster') {
    headline = '리듬이 살아난 날이에요. 회복으로 잘 마무리해요.'
  } else if (s.lastKmHeld) {
    headline = '마지막 1km가 무너지지 않았어요.'
  } else {
    headline = '오늘은 컨디션을 점검한 날이에요.'
  }

  // ── summary (사실 한 줄) ──
  const deltaTxt =
    s.paceVsUsual === 'faster'
      ? `평소보다 ${Math.abs(Math.round(s.deltaSec))}초 빠르게`
      : s.paceVsUsual === 'slower'
        ? `평소보다 ${Math.round(s.deltaSec)}초 여유 있게`
        : s.paceVsUsual === 'steady'
          ? '평소 페이스로'
          : ''
  const summary = profile.walkRun
    ? `${km}km 걷뛰 · ${run.course ?? '오늘의 코스'}`
    : `${km}km을 ${pace}/km로${deltaTxt ? `, ${deltaTxt}` : ''}`

  // ── good (좋은 점) ──
  const good: string[] = []
  if (care) {
    good.push(pick(['오늘도 나갔다는 것, 그게 이번 주의 핵심이에요.', '시작했고, 끝냈어요. 그거면 충분해요.'], seed))
    if (s.runCount >= 3) good.push(`최근 ${s.runCount}번째 러닝 — 리듬이 쌓이고 있어요.`)
    if (s.lastKmHeld)
      good.push(profile.walkRun ? '걷뛰 리듬을 끝까지 유지했어요.' : '끝까지 걷지 않고 리듬을 지켰어요.')
  } else {
    if (s.lastKmHeld) good.push('마지막 1km를 지켜냈어요.')
    if (s.negativeSplit) good.push('후반 스플릿이 더 빨랐어요 — 이상적인 분배예요.')
    if (s.paceVsUsual === 'faster') good.push(`평소보다 ${Math.abs(Math.round(s.deltaSec))}초 빠른 페이스였어요.`)
    if (!s.positiveBlowup && !s.negativeSplit) good.push('스플릿이 고르게 유지됐어요.')
  }
  if (good.length === 0) good.push('오늘의 러닝을 기록으로 남겼어요.')

  // ── watch (성능 관점 주의) ──
  const watch: string[] = []
  if (s.positiveBlowup) watch.push('후반에 페이스가 흔들렸어요. 초반을 조금 더 아껴보세요.')
  if (!care && s.paceVsUsual === 'faster' && s.loadSpike)
    watch.push('빠른 데다 거리도 늘었어요. 다음 이틀은 강도를 낮춰요.')
  if (watch.length === 0)
    watch.push(care ? '무리한 흔적은 없어요. 이 페이스가 딱 좋아요.' : '큰 경고 신호는 없어요. 회복만 챙기면 충분해요.')

  // ── safetyNote (안전/회복 — 항상 무료) ──
  let safetyNote: string | undefined
  const inj = (athlete.injuries ?? []).filter((x) => x !== 'none')
  if (inj.length > 0) {
    const label = INJURY_LABEL[inj[0]] ?? inj[0]
    safetyNote = `예전 ${label} 쪽이 불편했던 기록이 있어요. 통증이 오면 무리하지 말고 쉬거나 전문가와 상담하세요.`
  } else if (s.loadSpike) {
    safetyNote = '갑자기 늘어난 거리예요. 통증이 느껴지면 하루 더 쉬어가도 괜찮아요.'
  } else if ((athlete.ageBand === '50s' || athlete.ageBand === '60+') && !care) {
    safetyNote = '회복에 하루 더 두면 다음 러닝이 더 가벼워져요.'
  }

  // ── next (다음 러닝 추천) ──
  let next: string
  if (s.loadSpike) {
    next = care
      ? '다음은 20~30분 걷뛰로 회복 먼저 챙겨요.'
      : `다음 러닝은 ${pc.easy}로 20~30분 이지런, 회복 먼저.`
  } else if (goal) {
    next =
      goal.type === 'habit'
        ? '이번 주 한 번 더, 같은 시간대에 나가보기.'
        : goal.type === '5k'
          ? '다음엔 쉬엄쉬엄 거리만 1km 더 늘려보기.'
          : goal.type === '10k'
            ? `다음 롱런은 5분 더 길게, 페이스는 ${pc.easy} 그대로.`
            : goal.type === 'half'
              ? `다음 롱런은 천천히 거리부터 — ${pc.easy} 유지.`
              : `다음엔 ${pc.tempo} 템포 20분으로 자극을 줘요.`
  } else if (care) {
    next = '다음엔 같은 거리, 1분만 더 편하게.'
  } else {
    next = `다음엔 ${pc.itv} 4×1km 인터벌, 사이 90초 조깅.`
  }

  // ── certLine (인증카드용 한 줄) ──
  const certLine = care
    ? pick(['다시 돌아온 날.', '오늘도, 달렸다.', '내 페이스로 충분했다.'], seed)
    : pick(['끝까지 안 무너졌다.', '리듬을 되찾은 날.', '오늘의 나를 갱신했다.'], seed)

  return { headline, summary, good, watch, next, certLine, safetyNote, tone, signals: s }
}

/* ──────────────────────────────────────────────────────────────
   실제 AI API 전환 지점
   ──────────────────────────────────────────────────────────────
   1) buildCoachPrompt(ctx) 로 프롬프트를 만들고
   2) fetchCoachReview(ctx) 안에서 OpenAI 등으로 호출 → JSON 파싱 → RunReview 반환
   3) 컴포넌트에서 reviewRun(ctx) 대신 await fetchCoachReview(ctx) 로 교체
      (RunReview 계약이 동일하므로 표시 코드는 그대로, 로딩 상태만 추가)
*/
export function buildCoachPrompt(ctx: CoachContext): string {
  const { profile, athlete, goal, run, recentRuns } = ctx
  const lines = [
    '너는 러닝앱 BREQ의 코치다. 철학: 최고의 러닝은 가장 빠른 기록이 아니라 나에게 맞는 페이스를 찾는 질문이다.',
    '말투: 짧고 날카롭게. 의학적 진단 금지. 비교보다 해석. 체중/다이어트 자극 표현 금지.',
    `러너: 레벨=${profile.level}, 목적=${profile.purposes.join(',')}, 평소페이스=${profile.paceSec ?? '걷뛰'}`,
    `러너정보: 나이대=${athlete.ageBand ?? '-'}, 경력=${athlete.experience ?? '-'}, 부상이력=${(athlete.injuries ?? []).join(',') || '-'}, 주목표=${athlete.mainGoal ?? '-'}, 주당횟수=${athlete.weeklyTarget ?? '-'}`,
    `코칭목표: ${goal ? `${goal.type} ${goal.weeks}주 주${goal.daysPerWeek}회` : '없음'}`,
    `오늘 러닝: ${run.distanceKm}km / ${run.durationSec}s / splits=${(run.splits ?? []).join(',')}`,
    `최근 기록: ${recentRuns.slice(0, 5).map((r) => `${r.distanceKm}km`).join(', ')}`,
    'JSON으로 응답: {headline, summary, good[], watch[], next, certLine, safetyNote}',
  ]
  return lines.join('\n')
}

export async function fetchCoachReview(ctx: CoachContext): Promise<RunReview> {
  // signals/tone 은 결정적 계산이라 클라이언트에서 산출하고, 텍스트만 AI가 생성 → 병합.
  const signals = computeSignals(ctx)
  const tone: RunReview['tone'] = careTone(ctx.profile.level, ctx.profile.walkRun)
    ? 'care'
    : 'perform'
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: buildCoachPrompt(ctx), tone }),
    })
    if (!res.ok) throw new Error(`coach api ${res.status}`)
    const d = (await res.json()) as Partial<RunReview> & { error?: string }
    if (d.error) throw new Error(d.error)
    if (
      typeof d.headline !== 'string' ||
      typeof d.summary !== 'string' ||
      !Array.isArray(d.good) ||
      !Array.isArray(d.watch) ||
      typeof d.next !== 'string' ||
      typeof d.certLine !== 'string'
    ) {
      throw new Error('coach api: malformed response')
    }
    return {
      headline: d.headline,
      summary: d.summary,
      good: d.good,
      watch: d.watch,
      next: d.next,
      certLine: d.certLine,
      safetyNote: typeof d.safetyNote === 'string' && d.safetyNote ? d.safetyNote : undefined,
      tone,
      signals,
    }
  } catch (e) {
    // 실패(키 없음·네트워크·형식 오류) 시 규칙 기반 목업으로 폴백 — 앱은 항상 동작한다.
    console.warn('[coach] AI 호출 실패, 목업으로 폴백:', e)
    return reviewRun(ctx)
  }
}
