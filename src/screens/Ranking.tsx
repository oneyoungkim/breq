import { useState } from 'react'
import type { Profile } from '../types'
import {
  CATEGORY_META,
  crewPaceHidden,
  getRanking,
  setCrewPaceHidden,
  type RankCategory,
  type RankEntry,
  type RankScope,
} from '../rankings'
import { Avatar, BackHeader, Chip, LevelBadge, Toggle } from '../components/ui'

export function RankList({
  entries,
  onOpenUser,
}: {
  entries: RankEntry[]
  onOpenUser?: (name: string) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      {entries.map((e, i) => (
        <button
          key={`${e.name}-${i}`}
          onClick={() => onOpenUser?.(e.name)}
          className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
            e.me ? 'border-brand bg-brand/5' : 'border-line bg-card'
          } w-full text-left active:bg-card2`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-[14px] font-extrabold tabular-nums ${
              i === 0
                ? 'bg-brand text-white'
                : i < 3
                  ? 'bg-ink text-white'
                  : 'text-mute'
            }`}
          >
            {i + 1}
          </span>
          <Avatar name={e.name} size={32} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <p className="truncate text-[14px] font-bold text-ink">{e.name}</p>
            {e.me && (
              <span className="shrink-0 rounded-[2px] bg-brand px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                나
              </span>
            )}
            <LevelBadge level={e.level} small />
          </div>
          <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-ink">
            {e.value}
          </span>
        </button>
      ))}
    </div>
  )
}

/** 크루 내부 랭킹 패널 — 크루 탭 안에서 사용 */
export function CrewRankingPanel({
  profile,
  onOpenUser,
}: {
  profile: Profile
  onOpenUser?: (name: string) => void
}) {
  const [hidePace, setHidePace] = useState(crewPaceHidden)
  const cats: RankCategory[] = hidePace
    ? ['mileage', 'goal']
    : ['mileage', 'pace5', 'goal']
  const [cat, setCat] = useState<RankCategory>('mileage')
  const activeCat = cats.includes(cat) ? cat : 'mileage'

  return (
    <div className="mt-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {cats.map((c) => (
          <Chip key={c} active={activeCat === c} onClick={() => setCat(c)}>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] text-mute">{CATEGORY_META[activeCat].desc}</p>

      <RankList entries={getRanking('crew', activeCat, profile.name)} onOpenUser={onOpenUser} />

      {/* 크루장 설정 */}
      <div className="mt-4 rounded-2xl border border-line bg-card px-4 py-1.5">
        <Toggle
          on={!hidePace}
          onChange={(v) => {
            setHidePace(!v)
            setCrewPaceHidden(!v)
          }}
          label="페이스 랭킹 표시 (크루장 설정)"
          desc="슬로우러너가 많은 크루라면 끄는 걸 추천해요"
        />
      </div>
      {hidePace && (
        <p className="mt-2.5 border-l-2 border-mint pl-3 text-[12px] leading-relaxed text-mute">
          이 크루는 페이스보다 꾸준함을 봅니다. 크루장 설정으로 페이스 랭킹이 꺼져
          있어요.
        </p>
      )}
    </div>
  )
}

/** 전체 랭킹 화면 — 홈에서 진입 */
export default function Ranking({
  profile,
  onBack,
  onOpenUser,
}: {
  profile: Profile
  onBack: () => void
  onOpenUser?: (name: string) => void
}) {
  const [scope, setScope] = useState<RankScope>('app')
  const [cat, setCat] = useState<RankCategory>('mileage')

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader title="랭킹" onBack={onBack} />
      <div className="flex-1 px-4 pb-12 pt-4">
        {/* scope */}
        <div className="flex rounded-[4px] border border-line bg-card p-1">
          {(
            [
              ['app', '전체 BREQ'],
              ['crew', '반포 새벽런 클럽'],
            ] as [RankScope, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={`flex-1 rounded-[3px] py-2 text-[13px] font-bold transition-colors ${
                scope === key ? 'bg-ink text-white' : 'text-mute'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {scope === 'crew' ? (
          <CrewRankingPanel profile={profile} onOpenUser={onOpenUser} />
        ) : (
          <div className="mt-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {(['mileage', 'pace5', 'pace10', 'goal'] as RankCategory[]).map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {CATEGORY_META[c].label}
                </Chip>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] text-mute">{CATEGORY_META[cat].desc}</p>
            <RankList entries={getRanking('app', cat, profile.name)} onOpenUser={onOpenUser} />
            {cat === 'goal' && (
              <p className="mt-3 border-l-2 border-brand pl-3 text-[12px] leading-relaxed text-mute">
                목표 달성 랭킹은 속도가 아니라 약속을 지킨 정도를 봅니다. 지금 1위는
                슬로우러너예요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
