import type { Meetup, Profile } from '../types'
import { paceMatch, paceRangeLabel, tooFastForMe } from '../logic'
import { Avatar, BackHeader, LevelBadge, SectionTitle, Tag } from '../components/ui'
import RouteLine from '../components/RouteLine'

export default function MeetupDetail({
  meetup: m,
  profile,
  joined,
  onJoin,
  onBack,
  onOpenUser,
}: {
  meetup: Meetup
  profile: Profile
  joined: boolean
  onJoin: () => void
  onBack: () => void
  onOpenUser: (name: string) => void
}) {
  const match = paceMatch(profile.paceSec, profile.walkRun, m)
  const tooFast = tooFastForMe(profile.paceSec, profile.walkRun, m)
  const full = m.members.length >= m.max

  const rules: string[] = []
  if (m.noDrop) rules.push('뒤처지는 사람 없이 함께 들어와요 (스위퍼 지정)')
  if (m.quiet) rules.push('조용히 각자 페이스에 집중하는 모임이에요')
  else rules.push('대화하며 편하게 달리는 분위기예요')
  if (m.beginnerOk) rules.push('초보자 환영! 페이스 눈치 주기 금지')
  if (m.night) rules.push('야간 안전 모드 — 위치 공유 및 밝은 코스로 달려요')
  if (m.certRequired) rules.push('러닝 인증 필수 모임이에요')
  rules.push('완주 후 개인 기록 공개 여부는 본인이 선택해요')

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader title="모임 정보" onBack={onBack} />
      <div className="flex-1 px-4 pb-32 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {match && <Tag tone="mint">내 페이스 ✓</Tag>}
          <Tag>{m.region}</Tag>
          {m.night && <Tag tone="viol">야간 안전</Tag>}
        </div>
        <h1 className="mt-2 text-[22px] font-extrabold leading-snug text-ink">
          {m.title}
        </h1>
        <p className="mt-1 text-[13px] text-mute">
          {m.dateLabel} {m.time} · {m.spot}
        </p>

        {/* pace fit banner */}
        {match ? (
          <div className="mt-4 border-l-2 border-mint bg-mint/5 px-3.5 py-3 text-[13px] font-bold text-mint">
            내 페이스와 잘 맞는 모임이에요. 부담 없이 참가하세요.
          </div>
        ) : tooFast ? (
          <div className="mt-4 border-l-2 border-amber bg-amber/5 px-3.5 py-3 text-[13px] font-bold text-amber">
            내 평균 페이스보다 빠른 모임이에요. 무리하지 않아도 괜찮아요.
          </div>
        ) : (
          <div className="mt-4 border-l-2 border-line bg-card px-3.5 py-3 text-[13px] font-bold text-mute">
            내 페이스보다 여유로운 모임이에요. 회복런으로 좋아요.
          </div>
        )}

        {/* key stats */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-line border-y border-line">
          {[
            { k: 'PACE', v: paceRangeLabel(m.paceMin, m.paceMax).replace('/km', ''), s: 'min/km' },
            { k: 'DISTANCE', v: `${m.distanceKm}`, s: 'km' },
            { k: 'RUNNERS', v: `${m.members.length}/${m.max}`, s: '명' },
          ].map((c) => (
            <div key={c.k} className="px-3 py-4 text-center">
              <p className="eyebrow">{c.k}</p>
              <p className="mt-1.5 text-[18px] font-extrabold tabular-nums text-ink">{c.v}</p>
              <p className="text-[10px] text-mute">{c.s}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <SectionTitle>모임 소개</SectionTitle>
          <p className="rounded-2xl bg-card px-4 py-3.5 text-[14px] leading-relaxed text-ink/90">
            {m.desc}
          </p>
        </div>

        <div className="mt-5">
          <SectionTitle>코스</SectionTitle>
          <div className="rounded-2xl border border-line bg-card px-4 py-3.5">
            <RouteLine seed={m.id} className="h-24 w-full text-ink" />
            <p className="mt-2.5 border-t border-line pt-2.5 text-[13px] leading-relaxed text-ink/90">
              {m.course}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle>이 모임의 약속</SectionTitle>
          <ul className="space-y-2 rounded-2xl bg-card px-4 py-3.5">
            {rules.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink/90">
                <span className="text-brand">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <SectionTitle>모임장</SectionTitle>
          <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5">
            <button onClick={() => onOpenUser(m.host)} className="active:scale-[0.98]">
              <Avatar name={m.host} size={40} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => onOpenUser(m.host)}
                className="text-left text-[14px] font-bold text-ink active:text-brand"
              >
                {m.host}
              </button>
              <p className="text-[11px] text-mute">신뢰 점수 4.9 · 노쇼 0회</p>
            </div>
            <LevelBadge level={m.hostLevel} small />
          </div>
        </div>

        <div className="mt-5">
          <SectionTitle>
            참가자 {m.members.length}명
          </SectionTitle>
          <div className="flex flex-wrap gap-2 rounded-2xl bg-card px-4 py-3.5">
            {m.members.map((name) => (
              <button
                key={name}
                onClick={() => onOpenUser(name)}
                className="flex items-center gap-1.5 rounded-[3px] bg-card2 py-1 pl-1 pr-2.5 text-left active:bg-line"
              >
                <Avatar name={name} size={22} />
                <span className="text-[12px] font-semibold text-ink/90">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* join CTA */}
      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-bg/95 px-4 pb-5 pt-3 backdrop-blur">
        <button
          onClick={onJoin}
          disabled={joined || full}
          className={`w-full rounded-2xl py-4 text-[16px] font-bold transition-colors ${
            joined
              ? 'bg-mint/15 text-mint'
              : full
                ? 'bg-line text-mute'
                : 'bg-brand text-white'
          }`}
        >
          {joined ? '참가 완료 ✓ 당일에 만나요!' : full ? '정원 마감' : '참가하기'}
        </button>
      </div>
    </div>
  )
}
