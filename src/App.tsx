import { useState } from 'react'
import type { Meetup, Profile, RunRecord } from './types'
import { CREW, MEETUPS } from './data'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import MeetupDetail from './screens/MeetupDetail'
import CreateMeetup from './screens/CreateMeetup'
import CrewScreen from './screens/CrewScreen'
import Cert from './screens/Cert'
import ProfileScreen from './screens/ProfileScreen'
import Coaching from './screens/Coaching'
import RunLog from './screens/RunLog'
import RunTracker from './screens/RunTracker'
import Intro from './screens/Intro'
import Ranking from './screens/Ranking'
import UserGallery from './screens/UserGallery'

const LS_KEY = 'runnersway.profile'

type Tab = 'home' | 'crew' | 'log' | 'cert' | 'me'

const QUICK_RUN_PROFILE: Profile = {
  name: '러너',
  region: '오늘의 코스',
  paceSec: null,
  walkRun: true,
  distances: ['5km'],
  purposes: ['건강'],
  styles: ['혼자 뛰기'],
  level: 'slow',
}

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [meetups, setMeetups] = useState<Meetup[]>(MEETUPS)
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('home')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [coachingOpen, setCoachingOpen] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [userGalleryName, setUserGalleryName] = useState<string | null>(null)
  const [certPrefill, setCertPrefill] = useState<RunRecord | null>(null)

  const makeCertFrom = (r: RunRecord) => {
    setCertPrefill(r)
    setTrackerOpen(false)
    setTab('cert')
  }

  const finishOnboarding = (p: Profile) => {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
    setProfile(p)
  }

  const enterApp = () => {
    setTab('log')
    setIntroDone(true)
  }

  const startQuickRun = () => {
    if (!profile) {
      localStorage.setItem(LS_KEY, JSON.stringify(QUICK_RUN_PROFILE))
      setProfile(QUICK_RUN_PROFILE)
    }
    setIntroDone(true)
    setTab('log')
    setTrackerOpen(true)
  }

  const resetProfile = () => {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem('runnersway.goal')
    localStorage.removeItem('runnersway.plandone')
    setProfile(null)
    setTab('home')
  }

  const join = (id: string) => {
    if (!profile) return
    setJoinedIds(new Set([...joinedIds, id]))
    setMeetups(
      meetups.map((m) =>
        m.id === id && !m.members.includes(profile.name)
          ? { ...m, members: [...m.members, profile.name] }
          : m,
      ),
    )
  }

  const createMeetup = (m: Meetup) => {
    setMeetups([m, ...meetups])
    setJoinedIds(new Set([...joinedIds, m.id]))
    setCreating(false)
    setDetailId(m.id)
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[420px] overflow-hidden bg-bg shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      {!introDone ? (
        <Intro onDone={enterApp} onStartRun={startQuickRun} />
      ) : !profile ? (
        <Onboarding onDone={finishOnboarding} />
      ) : userGalleryName ? (
        <UserGallery
          name={userGalleryName}
          profile={profile}
          onBack={() => setUserGalleryName(null)}
        />
      ) : trackerOpen ? (
        <RunTracker
          profile={profile}
          onClose={() => setTrackerOpen(false)}
          onMakeCert={makeCertFrom}
        />
      ) : rankingOpen ? (
        <Ranking
          profile={profile}
          onBack={() => setRankingOpen(false)}
          onOpenUser={setUserGalleryName}
        />
      ) : coachingOpen ? (
        <Coaching profile={profile} onBack={() => setCoachingOpen(false)} />
      ) : creating ? (
        <CreateMeetup profile={profile} onCreate={createMeetup} onBack={() => setCreating(false)} />
      ) : detailId ? (
        (() => {
          const m = meetups.find((x) => x.id === detailId)
          if (!m) return null
          return (
            <MeetupDetail
              meetup={m}
              profile={profile}
              joined={joinedIds.has(m.id)}
              onJoin={() => join(m.id)}
              onBack={() => setDetailId(null)}
              onOpenUser={setUserGalleryName}
            />
          )
        })()
      ) : (
        <>
          {tab === 'home' && (
            <Home
              profile={profile}
              meetups={meetups}
              joinedIds={joinedIds}
              onOpen={setDetailId}
              onCreate={() => setCreating(true)}
              onOpenRanking={() => setRankingOpen(true)}
            />
          )}
          {tab === 'crew' && (
            <CrewScreen crew={CREW} profile={profile} onOpenUser={setUserGalleryName} />
          )}
          {tab === 'log' && (
            <RunLog
              profile={profile}
              onStartRun={() => setTrackerOpen(true)}
              onMakeCert={makeCertFrom}
              onOpenCoaching={() => setCoachingOpen(true)}
            />
          )}
          {tab === 'cert' && (
            <Cert
              key={certPrefill?.id ?? 'blank'}
              profile={profile}
              prefill={certPrefill}
              onStartRun={() => setTrackerOpen(true)}
            />
          )}
          {tab === 'me' && (
            <ProfileScreen
              profile={profile}
              onReset={resetProfile}
              onOpenCoaching={() => setCoachingOpen(true)}
              onOpenGallery={() => setUserGalleryName(profile.name)}
            />
          )}

          {/* bottom nav */}
          <nav className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[420px] -translate-x-1/2 grid-cols-5 border-t border-white/10 bg-ink/95 pb-4 pt-0 text-white shadow-[0_-18px_42px_rgba(0,0,0,0.2)] backdrop-blur">
            {(
              [
                ['home', '모임', 'MEET'],
                ['crew', '크루', 'CREW'],
                ['log', '기록', 'RUN'],
                ['cert', '인증', 'CARD'],
                ['me', '마이', 'MY'],
              ] as [Tab, string, string][]
            ).map(([key, label, en]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="relative flex flex-col items-center gap-0.5 pb-1 pt-3.5"
              >
                {tab === key && (
                  <span className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 bg-route" />
                )}
                <span
                  className={`text-[13px] font-extrabold ${
                    tab === key ? 'text-white' : 'text-white/45'
                  }`}
                >
                  {label}
                </span>
                <span
                  className={`text-[8px] font-bold tracking-[0.2em] ${
                    tab === key ? 'text-route' : 'text-white/25'
                  }`}
                >
                  {en}
                </span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}
