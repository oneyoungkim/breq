import { useMemo, useState } from 'react'
import type { Crew, Notice, Profile, ScheduleItem } from '../types'
import { Avatar, inputCls, LevelBadge, SectionTitle, Tag } from '../components/ui'
import { CrewRankingPanel } from './Ranking'

type InnerTab = 'notice' | 'schedule' | 'attend' | 'rank'

export default function CrewScreen({
  crew,
  profile,
  onOpenUser,
}: {
  crew: Crew
  profile: Profile
  onOpenUser: (name: string) => void
}) {
  const [tab, setTab] = useState<InnerTab>('notice')
  const [notices, setNotices] = useState<Notice[]>(crew.notices)
  const [newNotice, setNewNotice] = useState('')
  const [schedule, setSchedule] = useState<ScheduleItem[]>(crew.schedule)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({
    새벽반장: true,
    달리는수박: true,
    한강갈매기: false,
    말랑발바닥: true,
    커피전에한바퀴: false,
    러닝하는직장인: false,
    아침형러너: false,
  })

  const avgAttend = useMemo(
    () =>
      Math.round(
        crew.members.reduce((s, m) => s + m.attendRate, 0) / crew.members.length,
      ),
    [crew.members],
  )
  const checkedCount = Object.values(attendance).filter(Boolean).length

  const addNotice = () => {
    if (!newNotice.trim()) return
    setNotices([
      { id: `n${Date.now()}`, date: '오늘', text: newNotice.trim() },
      ...notices,
    ])
    setNewNotice('')
  }

  const sortedNotices = [...notices].sort(
    (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
  )

  return (
    <div className="px-4 pb-24 pt-5">
      {/* crew hero */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <Tag tone="mint">CREW LEADER</Tag>
          <span className="eyebrow">{crew.region}</span>
        </div>
        <h1 className="mt-2.5 text-[24px] font-black tracking-[-0.02em] text-ink">
          {crew.name}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{crew.intro}</p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-1">
          {[
            { k: 'MEMBERS', v: `${crew.members.length + 1}` },
            { k: 'ATTENDANCE', v: `${avgAttend}%` },
            { k: 'WEEKLY RUNS', v: `${schedule.length}` },
          ].map((s) => (
            <div key={s.k} className="px-2 py-2.5 text-center">
              <p className="text-[17px] font-extrabold tabular-nums text-ink">{s.v}</p>
              <p className="eyebrow mt-0.5">{s.k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* inner tabs */}
      <div className="mt-4 flex rounded-xl bg-card p-1">
        {(
          [
            ['notice', '게시판'],
            ['schedule', '정기런'],
            ['attend', '출석'],
            ['rank', '랭킹'],
          ] as [InnerTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-colors ${
              tab === key ? 'bg-card2 text-ink' : 'text-mute'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rank' && <CrewRankingPanel profile={profile} onOpenUser={onOpenUser} />}

      {tab === 'notice' && (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="크루원에게 인증, 후기, 공지 남기기"
              value={newNotice}
              onChange={(e) => setNewNotice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNotice()}
            />
            <button
              onClick={addNotice}
              className="shrink-0 rounded-xl bg-brand px-4 text-[14px] font-bold text-white disabled:opacity-30"
              disabled={!newNotice.trim()}
            >
              등록
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {sortedNotices.map((n) => (
              <div key={n.id} className="rounded-2xl bg-card px-4 py-3.5">
                <div className="flex items-center gap-2">
                  {n.pinned && <Tag tone="amber">📌 고정</Tag>}
                  <button
                    onClick={() => onOpenUser(n.id.startsWith('n') && !crew.notices.some((it) => it.id === n.id) ? profile.name : '새벽반장')}
                    className="flex items-center gap-1.5 rounded-[3px] bg-card2 py-0.5 pl-0.5 pr-2 text-left active:bg-line"
                  >
                    <Avatar
                      name={n.id.startsWith('n') && !crew.notices.some((it) => it.id === n.id) ? profile.name : '새벽반장'}
                      size={18}
                    />
                    <span className="text-[11px] font-extrabold text-ink">
                      {n.id.startsWith('n') && !crew.notices.some((it) => it.id === n.id) ? profile.name : '새벽반장'}
                    </span>
                  </button>
                  <span className="text-[11px] font-semibold text-mute">{n.date}</span>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink/90">{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="mt-4">
          <SectionTitle>정기런 일정</SectionTitle>
          <div className="space-y-2.5">
            {schedule.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-brand/10 text-[10px] font-extrabold tracking-[0.1em] text-brand">
                  RUN
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">{s.title}</p>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {s.dayTime} · {s.spot}
                  </p>
                </div>
                <Tag>{s.pace}</Tag>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setSchedule([
                ...schedule,
                {
                  id: `s${Date.now()}`,
                  title: '번개런',
                  dayTime: '이번 주 일 19:00',
                  spot: '반포대교 남단',
                  pace: '페이스 무관',
                },
              ])
            }
            className="mt-3 w-full rounded-2xl border border-dashed border-line py-3.5 text-[13px] font-bold text-mute"
          >
            + 일정 추가 (예시: 번개런)
          </button>
        </div>
      )}

      {tab === 'attend' && (
        <div className="mt-4">
          <div className="rounded-2xl bg-card px-4 py-3.5">
            <p className="text-[13px] font-bold text-ink">6/13 (토) 정기런 7K — 세빛섬 앞</p>
            <p className="mt-1 text-[12px] text-mute">
              출석 {checkedCount + 1}/{crew.members.length + 1}명 (크루장 포함) · 탭해서 체크
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {/* 크루장(나) */}
            <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
              <button onClick={() => onOpenUser(profile.name)} className="active:scale-[0.98]">
                <Avatar name={profile.name} size={36} />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => onOpenUser(profile.name)}
                  className="text-left text-[14px] font-bold text-ink active:text-brand"
                >
                  {profile.name}{' '}
                  <span className="text-[9px] font-extrabold tracking-[0.12em] text-amber">
                    LEADER
                  </span>
                </button>
                <AttendBar rate={97} />
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-mint text-[14px] font-bold text-bg">
                ✓
              </span>
            </div>
            {crew.members.map((m) => {
              const on = attendance[m.name] ?? false
              return (
                <div
                  key={m.name}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left"
                >
                  <button onClick={() => onOpenUser(m.name)} className="active:scale-[0.98]">
                    <Avatar name={m.name} size={36} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenUser(m.name)}
                        className="text-left text-[14px] font-bold text-ink active:text-brand"
                      >
                        {m.name}
                      </button>
                      <LevelBadge level={m.level} small />
                    </div>
                    <AttendBar rate={m.attendRate} />
                  </div>
                  <button
                    onClick={() => setAttendance({ ...attendance, [m.name]: !on })}
                    className={`flex h-7 w-7 items-center justify-center rounded-[3px] text-[14px] font-bold transition-colors ${
                      on ? 'bg-mint text-bg' : 'bg-line text-mute'
                    }`}
                    aria-label={`${m.name} 출석 체크`}
                  >
                    {on ? '✓' : ''}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-l-2 border-line pl-3 text-[12px] leading-relaxed text-mute">
            출석률은 멤버 신뢰 점수에 반영돼요. 노쇼가 잦은 멤버에게는 참가 전 리마인드
            알림이 한 번 더 발송됩니다.
          </p>
        </div>
      )}
    </div>
  )
}

function AttendBar({ rate }: { rate: number }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 w-24 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-mint"
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-mute">출석 {rate}%</span>
    </div>
  )
}
