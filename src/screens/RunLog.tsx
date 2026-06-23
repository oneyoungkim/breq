import { useEffect, useMemo, useState } from 'react'
import type { Goal, Profile, RunRecord, Workout } from '../types'
import { fmtPace } from '../logic'
import { generatePlan, GOAL_META } from '../coaching'
import { allRecentRuns, connectedIds, fmtClock, SOURCE_META } from '../runs'
import { buildContext, fetchCoachReview, isPro, reviewRun, type RunReview } from '../aiCoach'
import { BackHeader, SectionTitle, Tag } from '../components/ui'
import RouteLine from '../components/RouteLine'
import RouteMap from '../components/RouteMap'
import { trackDistanceKm } from '../components/RoutePath'

const GOAL_KEY = 'runnersway.goal'
const DONE_KEY = 'runnersway.plandone'

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function todayKo() {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]
}

function todayWorkout(
  goal: Goal | null,
  profile: Profile,
): { week: number; focus: string; workout: Workout; doneKey: string; done: boolean } | null {
  if (!goal) return null
  const done = loadJson<Record<string, boolean>>(DONE_KEY) ?? {}
  const plan = generatePlan(goal, profile.level, profile.paceSec)
  const week = plan.find((w) =>
    w.workouts.some((_, i) => !done[`${goal.type}-w${w.week}-${i}`]),
  ) ?? plan[0]
  const day = todayKo()
  const idxByDay = week.workouts.findIndex((w) => w.day === day)
  const idx = idxByDay >= 0 ? idxByDay : week.workouts.findIndex((_, i) => !done[`${goal.type}-w${week.week}-${i}`])
  const safeIdx = idx >= 0 ? idx : 0
  const doneKey = `${goal.type}-w${week.week}-${safeIdx}`
  return {
    week: week.week,
    focus: week.focus,
    workout: week.workouts[safeIdx],
    doneKey,
    done: !!done[doneKey],
  }
}

export default function RunLog({
  profile,
  onStartRun,
  onMakeCert,
  onOpenCoaching,
}: {
  profile: Profile
  onStartRun: () => void
  onMakeCert: (r: RunRecord) => void
  onOpenCoaching: () => void
}) {
  const [sel, setSel] = useState<RunRecord | null>(null)
  const [goal] = useState<Goal | null>(() => loadJson<Goal>(GOAL_KEY))
  const runs = allRecentRuns()
  const connected = connectedIds()
  const totalKm = Math.round(runs.reduce((s, r) => s + r.distanceKm, 0) * 10) / 10
  const today = todayWorkout(goal, profile)

  if (sel)
    return (
      <RunDetail
        r={sel}
        profile={profile}
        runs={runs}
        onBack={() => setSel(null)}
        onMakeCert={onMakeCert}
      />
    )

  return (
    <div className="px-4 pb-24 pt-5">
      <p className="eyebrow">ACTIVITY LOG</p>
      <h1 className="mt-1 text-[24px] font-black tracking-[-0.02em] text-ink">
        러닝 기록
      </h1>

      {runs.length > 0 && (
        <AiReviewCard
          profile={profile}
          run={runs[0]}
          runs={runs}
          onOpen={() => setSel(runs[0])}
        />
      )}

      <TodayPlanCard
        goal={goal}
        today={today}
        onOpenCoaching={onOpenCoaching}
      />

      {/* start CTA */}
      <button
        onClick={onStartRun}
        className="mt-4 flex w-full items-center gap-4 rounded-[4px] bg-brand p-5 text-left shadow-lg shadow-brand/25 active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] bg-black/20 text-[18px] text-white">
          ▶
        </span>
        <span>
          <span className="block text-[17px] font-extrabold text-white">러닝 시작하기</span>
          <span className="mt-0.5 block text-[11px] font-bold tracking-[0.1em] text-white/75">
            DISTANCE · PACE · SPLITS
          </span>
        </span>
      </button>

      {/* summary */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-line border-y border-line">
        {[
          { k: 'RUNS', v: `${runs.length}` },
          { k: 'TOTAL KM', v: `${totalKm}` },
          { k: 'SOURCES', v: `${connected.length + 1}` },
        ].map((s) => (
          <div key={s.k} className="px-2 py-3.5 text-center">
            <p className="text-[17px] font-extrabold tabular-nums text-ink">{s.v}</p>
            <p className="eyebrow mt-0.5">{s.k}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <SectionTitle>최근 기록</SectionTitle>
        {runs.length === 0 && (
          <div className="rounded-2xl bg-card px-4 py-8 text-center text-[13px] text-mute">
            아직 기록이 없어요.
            <br />
            러닝 시작하기로 첫 기록을 남겨보세요!
          </div>
        )}
        <div className="space-y-2.5">
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSel(r)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left active:bg-card2"
            >
              <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-[2px] bg-card2 text-[9px] font-extrabold tracking-[0.08em] text-ink/70">
                {SOURCE_META[r.source].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-ink">
                  {r.distanceKm}km · {fmtClock(r.durationSec)}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-mute">
                  {r.dateLabel} {r.startTime} · {SOURCE_META[r.source].name}
                  {r.course ? ` · ${r.course}` : ''}
                </span>
              </span>
              {r.splits.length >= 2 && <Spark data={r.splits} />}
              <span className="shrink-0 text-right">
                <span className="block text-[14px] font-extrabold tabular-nums text-ink">
                  {fmtPace(r.durationSec / r.distanceKm)}
                </span>
                <span className="text-[10px] text-mute">/km</span>
              </span>
            </button>
          ))}
        </div>
        {connected.length === 0 && (
          <p className="mt-3 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-mute">
            마이 탭에서 Apple 피트니스·가민 등을 연동하면 워치 기록이 자동으로 여기에
            모여요.
          </p>
        )}
      </div>
    </div>
  )
}

function TodayPlanCard({
  goal,
  today,
  onOpenCoaching,
}: {
  goal: Goal | null
  today: ReturnType<typeof todayWorkout>
  onOpenCoaching: () => void
}) {
  if (!goal || !today) {
    return (
      <button
        onClick={onOpenCoaching}
        className="mt-4 w-full rounded-[10px] border border-line bg-card px-4 py-4 text-left active:bg-card2"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand">
            Today's plan
          </span>
          <span className="text-[12px] font-bold text-brand">설정하기 →</span>
        </div>
        <p className="mt-2 text-[16px] font-extrabold text-ink">
          오늘 목표를 먼저 정해볼까요?
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-mute">
          코칭 목표를 만들면 기록 탭에서 오늘 훈련을 바로 확인하고 시작할 수 있어요.
        </p>
      </button>
    )
  }

  const meta = GOAL_META[goal.type]
  return (
    <div className="mt-4 rounded-[10px] bg-ink p-4 text-white club-shadow">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
          Today's plan
        </span>
        <Tag tone={today.done ? 'mint' : 'brand'}>{today.done ? '완료' : meta.code}</Tag>
      </div>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-route text-[15px] font-black text-white">
          {today.workout.day}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold leading-tight text-white">
            {today.workout.title}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/58">
            {today.workout.detail}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-[11px] font-bold text-white/45">
          {today.week}주차 · {today.focus}
        </span>
        <button
          onClick={onOpenCoaching}
          className="text-[12px] font-extrabold text-route"
        >
          전체 플랜 보기
        </button>
      </div>
    </div>
  )
}

/** AI 코치 리뷰 훅 — 즉시 목업으로 렌더 후 AI 결과가 오면 교체(폴백 내장). */
function useCoachReview(profile: Profile, run: RunRecord, runs: RunRecord[]) {
  const ctx = useMemo(() => buildContext(profile, run, runs), [profile, run, runs])
  const [review, setReview] = useState<RunReview>(() => reviewRun(ctx))
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setReview(reviewRun(ctx)) // 즉시 표시(레이아웃 안정) — AI 도착 시 교체
    fetchCoachReview(ctx)
      .then((r) => alive && setReview(r))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [ctx])
  return { review, loading }
}

function RunDetail({
  r,
  profile,
  runs,
  onBack,
  onMakeCert,
}: {
  r: RunRecord
  profile: Profile
  runs: RunRecord[]
  onBack: () => void
  onMakeCert: (r: RunRecord) => void
}) {
  const { review, loading } = useCoachReview(profile, r, runs)
  const avg = r.durationSec / Math.max(r.distanceKm, 0.01)
  const minSplit = r.splits.length ? Math.min(...r.splits) : 0
  const kcal = Math.round(r.distanceKm * 62)

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader title="기록 상세" onBack={onBack} />
      <div className="flex-1 px-4 pb-28 pt-4">
        <div className="flex items-center gap-2">
          <Tag>{SOURCE_META[r.source].icon} {SOURCE_META[r.source].name}</Tag>
          <span className="text-[12px] font-semibold text-mute">
            {r.dateLabel} {r.startTime}
          </span>
        </div>
        <p className="mt-2 text-[44px] font-black tabular-nums tracking-[-0.03em] text-ink">
          {r.distanceKm}
          <span className="text-[18px] font-bold text-mute"> km</span>
        </p>
        {r.course && <p className="text-[13px] text-mute">{r.course}</p>}

        <div className="mt-4 grid grid-cols-4 divide-x divide-line border-y border-line">
          {[
            { k: 'TIME', v: fmtClock(r.durationSec) },
            { k: 'PACE', v: fmtPace(avg) },
            { k: 'BPM', v: r.avgHr ? `${r.avgHr}` : '-' },
            { k: 'KCAL', v: `${kcal}` },
          ].map((c) => (
            <div key={c.k} className="px-1 py-3.5 text-center">
              <p className="text-[15px] font-extrabold tabular-nums text-ink">{c.v}</p>
              <p className="eyebrow mt-1">{c.k}</p>
            </div>
          ))}
        </div>

        <CoachSection review={review} loading={loading} />

        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <SectionTitle
            right={
              <span className="text-[10px] font-extrabold tracking-[0.1em] text-mute">
                {r.track && r.track.length >= 2
                  ? `GPS ${trackDistanceKm(r.track)}KM`
                  : `${r.distanceKm}KM`}
              </span>
            }
          >
            ROUTE
          </SectionTitle>
          {r.track && r.track.length >= 2 ? (
            <>
              <RouteMap points={r.track} height={220} />
              <p className="mt-2 text-[11px] text-mute">
                실제 GPS 경로 · {r.track.length}개 포인트
              </p>
            </>
          ) : (
            <RouteLine seed={r.id} className="h-28 w-full text-ink" />
          )}
        </div>

        {r.cadence && (
          <p className="mt-2 rounded-xl bg-card px-3.5 py-2.5 text-[12px] text-mute">
            케이던스 평균 <span className="font-bold text-ink">{r.cadence} spm</span>
            {r.avgHr ? (
              <>
                {' '}
                · 심박 존{' '}
                <span className="font-bold text-ink">
                  Z{r.avgHr > 155 ? 4 : r.avgHr > 145 ? 3 : 2}
                </span>
              </>
            ) : null}
          </p>
        )}

        {r.splits.length > 0 && (
          <div className="mt-4 rounded-2xl bg-card p-4">
            <SectionTitle
              right={
                <span className="text-[10px] font-extrabold tracking-[0.1em] text-mint">
                  BEST SPLIT
                </span>
              }
            >
              SPLITS
            </SectionTitle>
            <div className="space-y-1.5">
              {r.splits.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-9 text-[11px] font-semibold text-mute">{i + 1}km</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-[2px] bg-card2">
                    <div
                      className="h-full rounded-[2px]"
                      style={{
                        width: `${(minSplit / s) * 100}%`,
                        background: s === minSplit ? '#0b9e68' : '#d9d6cd',
                      }}
                    />
                  </div>
                  <span
                    className="w-12 text-right text-[12px] font-bold tabular-nums"
                    style={{ color: s === minSplit ? '#0b9e68' : '#17171a' }}
                  >
                    {fmtPace(s)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {r.memo && (
          <div className="mt-4 rounded-2xl bg-card px-4 py-3.5">
            <p className="text-[12px] font-bold text-mute">메모</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink/90">{r.memo}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-bg/95 px-4 pb-5 pt-3 backdrop-blur">
        <button
          onClick={() => onMakeCert(r)}
          className="w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white"
        >
          이 기록으로 인증 카드 만들기
        </button>
      </div>
    </div>
  )
}

/** 기록탭 상단 AI 러닝 리뷰 카드 (무료 티어) */
function AiReviewCard({
  profile,
  run,
  runs,
  onOpen,
}: {
  profile: Profile
  run: RunRecord
  runs: RunRecord[]
  onOpen: () => void
}) {
  const { review, loading } = useCoachReview(profile, run, runs)
  return (
    <div className="mt-4 rounded-[10px] bg-ink p-4 text-white club-shadow">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-route">
          AI 러닝 리뷰
        </span>
        <span className="rounded-[2px] bg-white/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.1em] text-white/60">
          {loading ? '해석 중…' : 'BETA'}
        </span>
      </div>
      <p className="mt-2.5 text-[17px] font-extrabold leading-snug text-white">{review.headline}</p>
      <p className="mt-1 text-[12px] text-white/55">{review.summary}</p>
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <CoachRow label="좋은 점" value={review.good[0]} dot="#0b9e68" />
        <CoachRow label="다음 러닝" value={review.next} dot="#1b64d8" />
      </div>
      {review.safetyNote && (
        <p className="mt-3 rounded-[6px] bg-route/15 px-3 py-2.5 text-[12px] leading-relaxed text-white/85">
          ⚠ {review.safetyNote}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button onClick={onOpen} className="text-[12px] font-extrabold text-route">
          BREQ Coach 자세히 →
        </button>
        <span className="rounded-[3px] bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/40">
          🔒 PRO · 4주 추세
        </span>
      </div>
    </div>
  )
}

/** 기록 상세 BREQ Coach 섹션 */
function CoachSection({ review, loading }: { review: RunReview; loading?: boolean }) {
  const pro = isPro()
  return (
    <div className="mt-4 rounded-[10px] bg-ink p-4 text-white club-shadow">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.16em] text-route">
          BREQ COACH
        </span>
        <span className="rounded-[2px] bg-white/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.1em] text-white/60">
          {loading ? '해석 중…' : 'AI · BETA'}
        </span>
      </div>
      <p className="mt-2.5 text-[16px] font-extrabold leading-snug text-white">{review.headline}</p>
      <p className="mt-1 text-[12px] text-white/55">{review.summary}</p>

      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <CoachRow label="좋은 점" value={review.good[0]} dot="#0b9e68" />
        <CoachRow label="다음 러닝" value={review.next} dot="#1b64d8" />
        <CoachRow label="카드 문구" value={`“${review.certLine}”`} dot="#7b45d8" />
      </div>

      {review.safetyNote && (
        <p className="mt-3 rounded-[6px] bg-route/15 px-3 py-2.5 text-[12px] leading-relaxed text-white/85">
          ⚠ {review.safetyNote}
        </p>
      )}

      {pro ? (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {review.watch.map((w, i) => (
            <CoachRow key={i} label="주의" value={w} dot="#ff8a1f" />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-[6px] border border-white/12 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-extrabold tracking-[0.14em] text-white/70">
              PRO 분석
            </span>
            <span className="text-[10px] font-bold text-white/40">🔒 잠금</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {['4주 추세 분석', '부상 위험 신호', '목표별 플랜 조정', '주간 AI 리포트'].map((t) => (
              <span
                key={t}
                className="rounded-[3px] bg-white/[0.05] px-2 py-1.5 text-[11px] font-semibold text-white/45"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CoachRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0">
        <p className="font-mono text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/40">
          {label}
        </p>
        <p className="text-[13px] leading-snug text-white/90">{value}</p>
      </div>
    </div>
  )
}

/** 구간 페이스 스파크라인 — 위쪽일수록 빠른 구간 */
function Spark({ data }: { data: number[] }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 52 + 2
      const y = max === min ? 10 : 3 + ((v - min) / (max - min)) * 14
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke="#0b9e68"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
