import { useMemo, useState } from 'react'
import type { Goal, GoalType, Profile } from '../types'
import { generatePlan, GOAL_META } from '../coaching'
import { LEVEL_META } from '../logic'
import { BackHeader, Chip, SectionTitle, Tag } from '../components/ui'

const GOAL_KEY = 'runnersway.goal'
const DONE_KEY = 'runnersway.plandone'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const KIND_TONE: Record<string, 'mint' | 'sky' | 'viol' | 'amber' | 'mute'> = {
  걷뛰: 'mint',
  이지런: 'sky',
  회복런: 'sky',
  인터벌: 'viol',
  템포런: 'viol',
  롱런: 'amber',
  챌린지: 'amber',
}

export default function Coaching({
  profile,
  onBack,
}: {
  profile: Profile
  onBack: () => void
}) {
  const [goal, setGoal] = useState<Goal | null>(() => load<Goal>(GOAL_KEY))
  const [done, setDone] = useState<Record<string, boolean>>(
    () => load<Record<string, boolean>>(DONE_KEY) ?? {},
  )
  const [week, setWeek] = useState(1)

  const meta = LEVEL_META[profile.level]
  const recommended = (Object.keys(GOAL_META) as GoalType[]).filter((g) =>
    GOAL_META[g].forLevels.includes(profile.level),
  )
  const [selType, setSelType] = useState<GoalType>(recommended[0] ?? 'habit')
  const [dpw, setDpw] = useState(3)

  const plan = useMemo(
    () => (goal ? generatePlan(goal, profile.level, profile.paceSec) : []),
    [goal, profile],
  )

  const saveGoal = () => {
    const g: Goal = { type: selType, weeks: GOAL_META[selType].weeks, daysPerWeek: dpw }
    localStorage.setItem(GOAL_KEY, JSON.stringify(g))
    localStorage.removeItem(DONE_KEY)
    setDone({})
    setWeek(1)
    setGoal(g)
  }

  const clearGoal = () => {
    localStorage.removeItem(GOAL_KEY)
    setGoal(null)
  }

  const toggleDone = (key: string) => {
    const next = { ...done, [key]: !done[key] }
    localStorage.setItem(DONE_KEY, JSON.stringify(next))
    setDone(next)
  }

  // ───────── 목표 설정 ─────────
  if (!goal) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg">
        <BackHeader title="러닝 코칭" onBack={onBack} />
        <div className="flex-1 px-4 pb-32 pt-4">
          <h1 className="text-[20px] font-extrabold text-ink">
            어떤 목표에 도전할까요?
          </h1>
          <p className="mt-1 text-[13px] text-mute">
            {meta.emoji} {meta.label} 기준으로 주 단위 훈련 스케줄을 만들어드려요.
          </p>

          <div className="mt-5 space-y-2.5">
            {(Object.keys(GOAL_META) as GoalType[]).map((g) => {
              const gm = GOAL_META[g]
              const on = selType === g
              const rec = recommended.includes(g)
              return (
                <button
                  key={g}
                  onClick={() => setSelType(g)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    on ? 'border-brand bg-brand/10' : 'border-line bg-card'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-[2px] text-[10px] font-extrabold tracking-[0.06em] ${
                        on ? 'bg-brand text-white' : 'bg-card2 text-mute'
                      }`}
                    >
                      {gm.code}
                    </span>
                    <span className="text-[15px] font-bold text-ink">{gm.label}</span>
                    <Tag>{gm.weeks}주</Tag>
                    {rec && <Tag tone="mint">내 레벨 추천</Tag>}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-mute">{gm.desc}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <SectionTitle>주 몇 번 달릴 수 있어요?</SectionTitle>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((d) => (
                <Chip key={d} active={dpw === d} onClick={() => setDpw(d)}>
                  주 {d}회
                </Chip>
              ))}
            </div>
            <p className="mt-2.5 border-l-2 border-line pl-3 text-[12px] text-mute">
              무리한 약속보다 지킬 수 있는 횟수가 좋아요. 나중에 바꿀 수 있어요.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-bg/95 px-4 pb-5 pt-3 backdrop-blur">
          <button
            onClick={saveGoal}
            className="w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white"
          >
            {GOAL_META[selType].weeks}주 플랜 만들기
          </button>
        </div>
      </div>
    )
  }

  // ───────── 주간 플랜 ─────────
  const gm = GOAL_META[goal.type]
  const cur = plan[week - 1]
  const weekKeys = cur.workouts.map((_, i) => `${goal.type}-w${week}-${i}`)
  const doneCount = weekKeys.filter((k) => done[k]).length

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader
        title="러닝 코칭"
        onBack={onBack}
        right={
          <button onClick={clearGoal} className="text-[12px] font-semibold text-mute">
            목표 변경
          </button>
        }
      />
      <div className="flex-1 px-4 pb-10 pt-4">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-[2px] bg-brand text-[11px] font-extrabold tracking-[0.06em] text-white">
              {gm.code}
            </span>
            <div>
              <h1 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">
                {gm.label}
              </h1>
              <p className="text-[12px] text-mute">
                {goal.weeks}주 플랜 · 주 {goal.daysPerWeek}회 · {meta.label} 맞춤
              </p>
            </div>
          </div>
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span className="text-mute">이번 주 진행</span>
              <span className="text-mint">
                {doneCount}/{cur.workouts.length} 완료
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-mint transition-all"
                style={{ width: `${(doneCount / cur.workouts.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {plan.map((p) => (
            <Chip key={p.week} active={week === p.week} onClick={() => setWeek(p.week)}>
              {p.week}주차
            </Chip>
          ))}
        </div>

        <p className="mt-3 text-[13px] font-bold text-ink">
          {week}주차 — <span className="text-brand">{cur.focus}</span>
        </p>

        <div className="mt-3 space-y-2.5">
          {cur.workouts.map((wo, i) => {
            const key = weekKeys[i]
            const isDone = !!done[key]
            return (
              <button
                key={key}
                onClick={() => toggleDone(key)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  isDone ? 'border-mint/40 bg-mint/5' : 'border-line bg-card'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card2 text-[14px] font-extrabold text-ink">
                  {wo.day}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Tag tone={KIND_TONE[wo.kind] ?? 'mute'}>{wo.kind}</Tag>
                    <span
                      className={`text-[14px] font-bold ${
                        isDone ? 'text-mute line-through' : 'text-ink'
                      }`}
                    >
                      {wo.title}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-mute">
                    {wo.detail}
                  </span>
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition-colors ${
                    isDone ? 'bg-mint text-bg' : 'bg-line text-mute'
                  }`}
                >
                  {isDone ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-4 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-mute">
          {profile.level === 'slow' || profile.level === 'easy'
            ? '한 번 빠져도 플랜은 무너지지 않아요. 다음 운동부터 이어가면 돼요.'
            : '강도 높은 날 사이엔 꼭 쉬거나 회복런으로 — 기록은 회복에서 늘어요.'}
        </p>
      </div>
    </div>
  )
}
