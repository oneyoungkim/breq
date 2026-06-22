import { type ReactNode, useState } from 'react'
import type { AgeBand, AthleteInfo, Goal, Profile, RunExperience, RunSource } from '../types'
import { fmtPace, fmtPaceKm, LEVEL_META } from '../logic'
import { GOAL_META, INTEGRATIONS } from '../coaching'
import { Chip, Field, inputCls, SectionTitle, Tag, Toggle } from '../components/ui'
import { allRecentRuns } from '../runs'
import { loadAthlete, saveAthlete } from '../aiCoach'
import {
  connectSource,
  disconnectSource,
  isNativeHealthAvailable,
  loadLastSync,
  syncAll,
} from '../health'

const GALLERY_KEY = 'runnersway.gallery'
const TILE_ACCENTS = ['#173f9f', '#0b8f6a', '#7b45d8', '#ff8a1f', '#101114']

type MiniPost = { id: string; distanceKm: number; accent: string; image?: string; title: string }

function loadGalleryPosts(name: string): MiniPost[] {
  try {
    const all = JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '{}') as Record<string, MiniPost[]>
    return all[name] ?? []
  } catch {
    return []
  }
}

function runToMiniPost(r: ReturnType<typeof allRecentRuns>[number]): MiniPost {
  return {
    id: `run-${r.id}`,
    title: `${r.distanceKm.toFixed(1)}K 인증`,
    distanceKm: r.distanceKm,
    accent: TILE_ACCENTS[Math.floor(r.distanceKm) % TILE_ACCENTS.length],
  }
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const WEEK_DONE = [true, false, true, false, true, false, false] // 목업: 월·수·금 러닝

function loadGoal(): Goal | null {
  try {
    const raw = localStorage.getItem('runnersway.goal')
    return raw ? (JSON.parse(raw) as Goal) : null
  } catch {
    return null
  }
}

export default function ProfileScreen({
  profile,
  onReset,
  onOpenCoaching,
  onOpenGallery,
}: {
  profile: Profile
  onReset: () => void
  onOpenCoaching: () => void
  onOpenGallery: () => void
}) {
  const goal = loadGoal()
  const [galleryPreview] = useState<MiniPost[]>(() => {
    const stored = loadGalleryPosts(profile.name)
    const fromRuns = allRecentRuns().slice(0, 6).map(runToMiniPost)
    fromRuns.forEach((r) => { if (!stored.some((p) => p.id === r.id)) stored.push(r) })
    return stored.slice(0, 6)
  })
  const [connected, setConnected] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('runnersway.integrations') ?? '[]')
    } catch {
      return []
    }
  })
  const [syncState, setSyncState] = useState<Record<string, string>>(() => loadLastSync())
  const [busy, setBusy] = useState<string | null>(null)
  const persist = (next: string[]) => {
    localStorage.setItem('runnersway.integrations', JSON.stringify(next))
    setConnected(next)
  }
  const connectIntegration = async (id: string) => {
    if (busy) return
    setBusy(id)
    try {
      const { status } = await connectSource(id as RunSource, new Date().toISOString())
      if (status === 'granted') {
        if (!connected.includes(id)) persist([...connected, id])
        setSyncState(loadLastSync())
      } else {
        alert('건강 데이터 접근 권한이 필요해요. 설정에서 허용해 주세요.')
      }
    } finally {
      setBusy(null)
    }
  }
  const disconnectIntegration = (id: string) => {
    disconnectSource(id as RunSource)
    persist(connected.filter((x) => x !== id))
    setSyncState(loadLastSync())
  }
  const resyncAll = async () => {
    if (busy || connected.length === 0) return
    setBusy('__all__')
    try {
      await syncAll(connected as RunSource[], new Date().toISOString())
      setSyncState(loadLastSync())
    } finally {
      setBusy(null)
    }
  }
  const meta = LEVEL_META[profile.level]
  const slowish = profile.level === 'slow' || profile.level === 'easy'
  const [publicRecord, setPublicRecord] = useState(!slowish)
  const [hidePaceInMeetup, setHidePaceInMeetup] = useState(slowish)
  const [nightSafe, setNightSafe] = useState(true)

  // 목업: 최근 6회 페이스 (기록러/템포러용 그래프)
  const base = profile.paceSec ?? 420
  const recent = [base + 24, base + 15, base + 18, base + 8, base + 10, base + 2]
  const maxP = Math.max(...recent)
  const minP = Math.min(...recent)

  return (
    <div className="px-4 pb-24 pt-5">
      {/* hero */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="eyebrow">
          {profile.region} ·{' '}
          {profile.walkRun || profile.paceSec == null
            ? 'WALK-RUN'
            : `AVG ${fmtPaceKm(profile.paceSec)}`}
        </p>
        <h1 className="mt-2 text-[28px] font-black tracking-[-0.02em] text-ink">
          {profile.name}
        </h1>
        <p
          className="mt-1 text-[12px] font-extrabold uppercase tracking-[0.14em]"
          style={{ color: meta.color }}
        >
          {meta.code} — {meta.label}
        </p>
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-line pt-3.5">
          {profile.purposes.map((p) => (
            <Tag key={p}>{p}</Tag>
          ))}
          {profile.styles.map((s) => (
            <Tag key={s} tone="sky">
              {s}
            </Tag>
          ))}
        </div>
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { k: '이번 주', v: '3회' },
          { k: '이번 달', v: '42km' },
          { k: '출석률', v: '86%' },
          { k: '연속', v: '2주' },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl bg-card px-2 py-3 text-center">
            <p className="text-[16px] font-extrabold text-ink">{s.v}</p>
            <p className="mt-0.5 text-[11px] text-mute">{s.k}</p>
          </div>
        ))}
      </div>

      {/* photo log mini preview */}
      <div className="mt-4 rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="eyebrow">PHOTO LOG</span>
            {galleryPreview.length > 0 && (
              <span className="rounded-[3px] bg-brand/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand">
                {galleryPreview.length}
              </span>
            )}
          </div>
          <button onClick={onOpenGallery} className="text-[12px] font-bold text-brand">
            전체보기 →
          </button>
        </div>

        {galleryPreview.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[4px]">
              {galleryPreview.map((post) => (
                <button
                  key={post.id}
                  onClick={onOpenGallery}
                  className="aspect-square overflow-hidden"
                  aria-label={post.title}
                >
                  {post.image ? (
                    <img src={post.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col justify-end p-2 text-white"
                      style={{
                        background: `linear-gradient(135deg, ${post.accent} 0%, #101114 62%)`,
                      }}
                    >
                      <p className="text-[18px] font-black leading-none">
                        {post.distanceKm ? post.distanceKm.toFixed(1) : 'RUN'}
                      </p>
                      <p className="font-mono text-[7px] font-bold text-white/55">
                        {post.distanceKm ? 'KM' : 'PHOTO'}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={onOpenGallery}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-line py-2.5 text-[13px] font-extrabold text-ink"
            >
              <span>인증 올리기</span>
              <span className="text-route">+</span>
            </button>
          </>
        ) : (
          <button
            onClick={onOpenGallery}
            className="w-full rounded-[4px] border border-dashed border-line py-8 text-center"
          >
            <p className="text-[13px] font-bold text-ink">아직 인증 기록이 없어요.</p>
            <p className="mt-1 text-[12px] text-mute">첫 러닝 기록이나 사진을 올려보세요 →</p>
          </button>
        )}
      </div>

      {/* coaching */}
      <button
        onClick={onOpenCoaching}
        className="mt-4 w-full rounded-2xl border border-brand/40 bg-gradient-to-r from-brand/15 to-card p-4 text-left"
      >
        {goal ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-10 items-center justify-center rounded-[2px] bg-brand text-[10px] font-extrabold tracking-[0.06em] text-white">
                {GOAL_META[goal.type].code}
              </span>
              <span className="text-[15px] font-bold text-ink">
                {GOAL_META[goal.type].label}
              </span>
              <Tag tone="mint">ACTIVE</Tag>
            </div>
            <p className="mt-1.5 text-[12px] text-mute">
              {goal.weeks}주 플랜 · 주 {goal.daysPerWeek}회 — 이번 주 스케줄 보기 →
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <Tag tone="brand">COACHING</Tag>
              <span className="text-[15px] font-bold text-ink">러닝 코칭 시작하기</span>
            </div>
            <p className="mt-1.5 text-[12px] text-mute">
              목표를 정하면 {meta.label} 맞춤 주간 훈련 스케줄을 만들어드려요 →
            </p>
          </>
        )}
      </button>

      <AthleteCard />

      {/* level-differentiated widget */}
      {slowish ? (
        <div className="mt-4 rounded-2xl bg-card p-4">
          <SectionTitle
            right={<span className="text-[12px] font-bold text-mint">목표 3/4 달성 중</span>}
          >
            이번 주 출석
          </SectionTitle>
          <div className="flex justify-between">
            {DAYS.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-[4px] text-[15px] font-bold ${
                    WEEK_DONE[i] ? 'bg-mint text-bg' : 'bg-card2 text-mute'
                  }`}
                >
                  {WEEK_DONE[i] ? '✓' : d}
                </span>
                <span className="text-[10px] text-mute">{d}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-l-2 border-mint pl-3 text-[12px] leading-relaxed text-mute">
            페이스 그래프요? 여기엔 없어요. {meta.label}에게 중요한 건 속도가 아니라
            <span className="font-bold text-mint"> 오늘도 나갔다는 사실</span>이니까요.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-card p-4">
          <SectionTitle
            right={
              <span className="text-[12px] font-bold" style={{ color: meta.color }}>
                최근 22초 단축 ↓
              </span>
            }
          >
            최근 6회 페이스
          </SectionTitle>
          <div className="flex h-28 items-end justify-between gap-2">
            {recent.map((p, i) => {
              const ratio = maxP === minP ? 1 : 1 - (p - minP) / (maxP - minP)
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-semibold text-mute">{fmtPace(p)}</span>
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${30 + ratio * 60}%`,
                      background: i === recent.length - 1 ? meta.color : '#d9d6cd',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-mute">← 오래전 · 최근 →</p>
        </div>
      )}

      {/* integrations */}
      <div className="mt-4 rounded-2xl bg-card p-4">
        <SectionTitle
          right={
            connected.length > 0 ? (
              <button
                onClick={resyncAll}
                disabled={!!busy}
                className="text-[12px] font-bold text-brand disabled:opacity-40"
              >
                {busy === '__all__' ? '동기화 중…' : '지금 동기화'}
              </button>
            ) : undefined
          }
        >
          워치 · 앱 연동
        </SectionTitle>
        <div className="space-y-1">
          {INTEGRATIONS.map((it) => {
            const on = connected.includes(it.id)
            const isApple = it.id === 'apple'
            return (
              <div key={it.id} className="flex items-center gap-3 py-2">
                <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-[2px] bg-card2 text-[9px] font-extrabold tracking-[0.08em] text-ink/70">
                  {it.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">
                    {isApple ? 'Apple 건강 · 애플워치' : it.name}
                  </p>
                  <p className="text-[11px] text-mute">
                    {on ? `연동됨 · ${syncLabel(syncState[it.id])}` : it.desc}
                  </p>
                </div>
                {on ? (
                  <button
                    onClick={() => disconnectIntegration(it.id)}
                    className="shrink-0 rounded-[3px] bg-mint/15 px-3.5 py-1.5 text-[12px] font-bold text-mint"
                  >
                    연동됨 ✓
                  </button>
                ) : (
                  <button
                    onClick={() => connectIntegration(it.id)}
                    disabled={!!busy}
                    className="shrink-0 rounded-[3px] bg-brand px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
                  >
                    {busy === it.id ? '연결 중…' : '연동'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-2 rounded-xl bg-bg/60 px-3 py-2.5 text-[11px] leading-relaxed text-mute">
          {isNativeHealthAvailable()
            ? '애플워치로 기록한 러닝(HealthKit)이 자동으로 들어와요. 인증 카드도 입력 없이 바로.'
            : '지금은 미리보기(샘플) 데이터예요. 실제 애플워치 기록은 iOS 앱(HealthKit)에서 동기화됩니다.'}
        </p>
      </div>

      {/* settings */}
      <div className="mt-4 rounded-2xl bg-card px-4 py-2">
        <Toggle
          on={publicRecord}
          onChange={setPublicRecord}
          label="완주 후 기록 공개"
          desc="끄면 모임 완주 후에도 내 기록이 비공개로 유지돼요"
        />
        <Toggle
          on={hidePaceInMeetup}
          onChange={setHidePaceInMeetup}
          label="모임에서 페이스 숨기기"
          desc="참가자 목록에 레벨만 표시돼요"
        />
        <Toggle
          on={nightSafe}
          onChange={setNightSafe}
          label="야간 안전 모드"
          desc="야간 러닝 시 보호 연락처에 위치를 공유해요"
        />
      </div>

      <button
        onClick={onReset}
        className="mt-4 w-full rounded-2xl border border-line py-3.5 text-[13px] font-bold text-mute"
      >
        프로필 다시 만들기 (온보딩 재시작)
      </button>
      <p className="mt-4 text-center text-[11px] font-bold tracking-[0.14em] text-mute/60">
        BREQ — BEST RUN EVER QUEST · PROTOTYPE v0.1
      </p>
    </div>
  )
}

const AGE_OPTS: [AgeBand, string][] = [
  ['10s', '10대'],
  ['20s', '20대'],
  ['30s', '30대'],
  ['40s', '40대'],
  ['50s', '50대'],
  ['60+', '60+'],
]
const EXP_OPTS: [RunExperience, string][] = [
  ['new', '입문'],
  ['under1y', '1년 미만'],
  ['1to3y', '1~3년'],
  ['over3y', '3년+'],
]
const GOAL_OPTS = ['습관 만들기', '5K 완주', '10K', '하프', '기록 단축(PB)', '체중 관리', '스트레스 해소']
const INJURY_OPTS: [string, string][] = [
  ['knee', '무릎'],
  ['ankle', '발목'],
  ['hip', '고관절'],
  ['shin', '정강이'],
  ['calf', '종아리'],
  ['back', '허리'],
  ['plantar', '족저근막'],
  ['hamstring', '햄스트링'],
]

/** AI 코치가 참고하는 러너 정보 — 전부 선택 입력, 변경 즉시 localStorage 저장 */
function AthleteCard() {
  const [a, setA] = useState<AthleteInfo>(() => loadAthlete())
  const [moreOpen, setMoreOpen] = useState(false)

  const update = (patch: Partial<AthleteInfo>) => {
    const next = { ...a, ...patch }
    setA(next)
    saveAthlete(next)
  }
  const toggleInjury = (id: string) => {
    if (id === 'none') return update({ injuries: [] })
    const cur = (a.injuries ?? []).filter((x) => x !== 'none')
    update({ injuries: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }
  const noInjury = !a.injuries || a.injuries.length === 0

  return (
    <div className="mt-4 rounded-2xl bg-card p-4">
      <SectionTitle
        right={
          <span className="font-mono text-[10px] font-extrabold tracking-[0.14em] text-brand">
            FOR AI COACH
          </span>
        }
      >
        러너 정보
      </SectionTitle>

      <div className="space-y-3.5">
        <Row label="나이대">
          {AGE_OPTS.map(([v, l]) => (
            <Chip key={v} active={a.ageBand === v} onClick={() => update({ ageBand: a.ageBand === v ? undefined : v })}>
              {l}
            </Chip>
          ))}
        </Row>

        <Row label="러닝 경력">
          {EXP_OPTS.map(([v, l]) => (
            <Chip key={v} active={a.experience === v} onClick={() => update({ experience: a.experience === v ? undefined : v })}>
              {l}
            </Chip>
          ))}
        </Row>

        <Row label="주당 러닝 횟수">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} active={a.weeklyTarget === n} onClick={() => update({ weeklyTarget: a.weeklyTarget === n ? undefined : n })}>
              {n}회
            </Chip>
          ))}
        </Row>

        <Row label="주 목표">
          {GOAL_OPTS.map((g) => (
            <Chip key={g} active={a.mainGoal === g} onClick={() => update({ mainGoal: a.mainGoal === g ? undefined : g })}>
              {g}
            </Chip>
          ))}
        </Row>

        <Row label="부상 이력 (해당 부위)">
          <Chip active={noInjury} onClick={() => toggleInjury('none')}>
            없음
          </Chip>
          {INJURY_OPTS.map(([v, l]) => (
            <Chip key={v} active={(a.injuries ?? []).includes(v)} onClick={() => toggleInjury(v)}>
              {l}
            </Chip>
          ))}
        </Row>

        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="text-[12px] font-bold text-mute"
        >
          키 · 몸무게 (선택) {moreOpen ? '▲' : '▼'}
        </button>
        {moreOpen && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="키 (cm)">
              <input
                type="number"
                className={inputCls}
                placeholder="예: 172"
                value={a.heightCm ?? ''}
                onChange={(e) => update({ heightCm: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
            <Field label="몸무게 (kg)">
              <input
                type="number"
                className={inputCls}
                placeholder="예: 64"
                value={a.weightKg ?? ''}
                onChange={(e) => update({ weightKg: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
          </div>
        )}
      </div>

      <p className="mt-3 rounded-xl bg-bg/60 px-3 py-2.5 text-[11px] leading-relaxed text-mute">
        전부 선택 입력이에요. 적지 않아도 앱은 그대로 쓸 수 있고, 적을수록 AI 해석이 더
        정확해져요. 키·몸무게는 다이어트 조언이 아니라 러닝 부하 해석에만 참고해요.
      </p>
    </div>
  )
}

function syncLabel(iso?: string): string {
  if (!iso) return '동기화 대기'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '동기화됨'
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return '방금 동기화'
  if (min < 60) return `${min}분 전 동기화`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전 동기화`
  return `${Math.floor(hr / 24)}일 전 동기화`
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.1em] text-mute">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
