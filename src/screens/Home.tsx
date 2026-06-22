import { useMemo, useState } from 'react'
import type { Meetup, Profile } from '../types'
import { fmtPaceKm, LEVEL_META, paceMatch, paceRangeLabel } from '../logic'
import { Chip, LevelBadge, Tag } from '../components/ui'

export default function Home({
  profile,
  meetups,
  joinedIds,
  onOpen,
  onCreate,
  onOpenRanking,
}: {
  profile: Profile
  meetups: Meetup[]
  joinedIds: Set<string>
  onOpen: (id: string) => void
  onCreate: () => void
  onOpenRanking: () => void
}) {
  const [myRegion, setMyRegion] = useState(false)
  const [myPace, setMyPace] = useState(false)
  const [beginner, setBeginner] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const [night, setNight] = useState(false)

  const meta = LEVEL_META[profile.level]

  const filtered = useMemo(() => {
    let list = meetups.filter((m) => {
      // 직접 입력한 동네도 느슨하게 매칭 (예: '반포' ↔ '반포·잠원')
      const regionHit =
        m.region.includes(profile.region) || profile.region.includes(m.region)
      if (myRegion && !regionHit) return false
      if (myPace && !paceMatch(profile.paceSec, profile.walkRun, m)) return false
      if (beginner && !m.beginnerOk) return false
      if (quiet && !m.quiet) return false
      if (night && !m.night) return false
      return true
    })
    // 페이스 맞는 모임 먼저
    return [...list].sort(
      (a, b) =>
        Number(paceMatch(profile.paceSec, profile.walkRun, b)) -
        Number(paceMatch(profile.paceSec, profile.walkRun, a)),
    )
  }, [meetups, myRegion, myPace, beginner, quiet, night, profile])

  return (
    <div className="pb-24">
      {/* header */}
      <div className="urban-grid mx-3 mt-3 rounded-[10px] bg-ink px-4 pb-4 pt-4 text-white club-shadow">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-route">
            Neighborhood runs
          </span>
          <span className="h-1.5 w-14 rounded-full bg-route" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
              {profile.region} ·{' '}
              {profile.walkRun || profile.paceSec == null
                ? 'WALK-RUN'
                : `AVG ${fmtPaceKm(profile.paceSec)}`}
            </p>
            <h1 className="mt-1.5 text-[28px] font-black leading-[0.98] tracking-[-0.02em] text-white">
              {profile.name},
              <br />
              오늘도 내 페이스대로
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <LevelBadge level={profile.level} />
            <button
              onClick={onOpenRanking}
              className="rounded-[3px] bg-white px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] text-ink"
            >
              랭킹 →
            </button>
          </div>
        </div>
        <p
          className="mt-4 border-l-2 border-route pl-3 text-[12px] text-white/60"
        >
          {meta.label}에게 잘 맞는 모임을 위로 올려뒀어요
        </p>
      </div>

      {/* filters */}
      <div className="no-scrollbar sticky top-0 z-10 mt-1 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-3 backdrop-blur">
        <Chip active={myPace} onClick={() => setMyPace(!myPace)}>
          내 페이스
        </Chip>
        <Chip active={myRegion} onClick={() => setMyRegion(!myRegion)}>
          {profile.region}
        </Chip>
        <Chip active={beginner} onClick={() => setBeginner(!beginner)}>
          초보 환영
        </Chip>
        <Chip active={quiet} onClick={() => setQuiet(!quiet)}>
          조용한 런
        </Chip>
        <Chip active={night} onClick={() => setNight(!night)}>
          야간 안전
        </Chip>
      </div>

      {/* list */}
      <div className="space-y-3 px-4 pt-1">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card px-4 py-10 text-center text-[13px] text-mute">
            조건에 맞는 모임이 없어요.
            <br />
            직접 모임을 만들어 보는 건 어때요?
          </div>
        )}
        {filtered.map((m) => {
          const match = paceMatch(profile.paceSec, profile.walkRun, m)
          const joined = joinedIds.has(m.id)
          const full = m.members.length >= m.max
          return (
            <button
              key={m.id}
              onClick={() => onOpen(m.id)}
              className="w-full rounded-[10px] border border-line bg-card p-4 text-left shadow-sm active:bg-card2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {match && <Tag tone="mint">내 페이스 ✓</Tag>}
                    {joined && <Tag tone="sky">참가 중</Tag>}
                    {full && !joined && <Tag tone="amber">마감</Tag>}
                  </div>
                  <h3 className="mt-1.5 truncate text-[16px] font-bold text-ink">
                    {m.title}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {m.dateLabel} {m.time} · {m.spot}
                  </p>
                </div>
                <div className="shrink-0 rounded-[6px] bg-bg px-3 py-2 text-right">
                  <p className="text-[15px] font-extrabold tabular-nums text-ink">
                    {paceRangeLabel(m.paceMin, m.paceMax).replace('/km', '')}
                  </p>
                  <p className="text-[9px] font-bold tracking-[0.14em] text-mute">MIN/KM</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Tag>{m.distanceKm}km</Tag>
                {m.beginnerOk && <Tag tone="mint">초보 환영</Tag>}
                {m.noDrop && <Tag tone="sky">뒤처짐 없는 런</Tag>}
                {m.quiet ? <Tag>조용한 모임</Tag> : <Tag>수다 환영</Tag>}
                {m.night && <Tag tone="viol">야간 안전</Tag>}
                <span className="ml-auto text-[12px] font-semibold text-mute">
                  {m.members.length}/{m.max}명
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* FAB */}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 justify-end px-4">
        <button
          onClick={onCreate}
          className="pointer-events-auto flex items-center gap-1.5 rounded-[4px] bg-route px-5 py-3.5 text-[13px] font-extrabold tracking-[0.02em] text-white shadow-lg shadow-route/25"
        >
          + 모임 만들기
        </button>
      </div>
    </div>
  )
}
