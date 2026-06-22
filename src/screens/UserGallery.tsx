import { useMemo, useRef, useState } from 'react'
import type { Profile, RunRecord } from '../types'
import { fmtPaceKm, LEVEL_META } from '../logic'
import { allRecentRuns, fmtClock, SOURCE_META } from '../runs'
import { Avatar, BackHeader, LevelBadge, Tag } from '../components/ui'

type GalleryPost = {
  id: string
  title: string
  date: string
  caption: string
  distanceKm: number
  paceSec: number
  course: string
  accent: string
  image?: string
}

const GALLERY_KEY = 'runnersway.gallery'

const ACCENTS = ['#173f9f', '#0b8f6a', '#7b45d8', '#ff8a1f', '#101114']
const COURSES = ['반포 한강', '잠수교 왕복', '서울숲 루프', '새벽 5K', '퇴근 후 한 바퀴']
const CAPTIONS = [
  '오늘도 나간 사람만 아는 기분.',
  '페이스보다 중요한 건 다시 시작한 것.',
  '천천히 뛰었는데 하루가 가벼워졌다.',
  '기록은 짧고 루트는 오래 남는다.',
  '혼자 뛰었지만 혼자가 아닌 느낌.',
]

function hashName(name: string) {
  return [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
}

function loadStoredPosts(name: string): GalleryPost[] {
  try {
    const all = JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '{}') as Record<string, GalleryPost[]>
    return all[name] ?? []
  } catch {
    return []
  }
}

function saveStoredPosts(name: string, posts: GalleryPost[]) {
  const all = JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '{}') as Record<string, GalleryPost[]>
  localStorage.setItem(GALLERY_KEY, JSON.stringify({ ...all, [name]: posts }))
}

function postFromRun(r: RunRecord): GalleryPost {
  const pace = Math.round(r.durationSec / r.distanceKm)
  return {
    id: `run-${r.id}`,
    title: `${r.distanceKm.toFixed(1)}K 인증`,
    date: `${r.dateLabel} ${r.startTime}`,
    caption: `${SOURCE_META[r.source].name}에서 가져온 오늘의 러닝.`,
    distanceKm: r.distanceKm,
    paceSec: pace,
    course: r.course ?? 'BREQ route',
    accent: ACCENTS[Math.floor(r.distanceKm) % ACCENTS.length],
  }
}

function mockPosts(name: string): GalleryPost[] {
  const seed = hashName(name)
  return Array.from({ length: 9 }, (_, i) => {
    const distance = Number((3 + ((seed + i * 7) % 90) / 10).toFixed(1))
    const pace = 330 + ((seed + i * 23) % 160)
    return {
      id: `${name}-${i}`,
      title: i % 3 === 0 ? '오런완' : i % 3 === 1 ? '모닝 루트' : '크루 인증',
      date: i === 0 ? '오늘' : `6/${12 - (i % 7)}`,
      caption: CAPTIONS[(seed + i) % CAPTIONS.length],
      distanceKm: distance,
      paceSec: pace,
      course: COURSES[(seed + i * 2) % COURSES.length],
      accent: ACCENTS[(seed + i) % ACCENTS.length],
    }
  })
}

function stats(posts: GalleryPost[]) {
  const distance = posts.reduce((sum, p) => sum + p.distanceKm, 0)
  const avg = posts.length
    ? Math.round(posts.reduce((sum, p) => sum + p.paceSec, 0) / posts.length)
    : 0
  return { distance, avg }
}

export default function UserGallery({
  name,
  profile,
  onBack,
}: {
  name: string
  profile: Profile
  onBack: () => void
}) {
  const mine = name === profile.name
  const fileRef = useRef<HTMLInputElement>(null)
  const [stored, setStored] = useState<GalleryPost[]>(() => loadStoredPosts(name))
  const [selected, setSelected] = useState<GalleryPost | null>(null)

  const runPosts = useMemo(
    () => (mine ? allRecentRuns().slice(0, 6).map(postFromRun) : []),
    [mine],
  )
  const posts = mine
    ? [...stored, ...runPosts.filter((r) => !stored.some((p) => p.id === r.id))]
    : [...stored, ...mockPosts(name)]
  const summary = stats(posts)
  const level = mine ? profile.level : (['slow', 'easy', 'tempo', 'racer'] as const)[hashName(name) % 4]
  const meta = LEVEL_META[level]

  const addFromLatestRun = () => {
    const run = allRecentRuns()[0]
    if (!run) return
    const next = [postFromRun(run), ...stored.filter((p) => p.id !== `run-${run.id}`)]
    setStored(next)
    saveStoredPosts(name, next)
  }

  const addPhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const nextPost: GalleryPost = {
        id: `photo-${Date.now()}`,
        title: '러닝 무드',
        date: '방금',
        caption: '내 인증 기록에 사진 한 장 추가.',
        distanceKm: 0,
        paceSec: profile.paceSec ?? 420,
        course: profile.region,
        accent: '#173f9f',
        image: String(reader.result),
      }
      const next = [nextPost, ...stored]
      setStored(next)
      saveStoredPosts(name, next)
      setSelected(nextPost)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader title={name} onBack={onBack} right={<LevelBadge level={level} small />} />
      <div className="flex-1 pb-12">
        <div className="px-4 pt-4">
          <div className="flex items-center gap-4">
            <Avatar name={name} size={72} />
            <div className="grid flex-1 grid-cols-3 divide-x divide-line border-y border-line py-2 text-center">
              <ProfileStat label="POSTS" value={posts.length} />
              <ProfileStat label="KM" value={summary.distance.toFixed(1)} />
              <ProfileStat label="PACE" value={summary.avg ? fmtPaceKm(summary.avg).replace('/km', '') : '-'} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[17px] font-black tracking-[-0.01em] text-ink">{name}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/75">
              {mine
                ? '내 러닝 인증, 사진, 루트를 모아두는 개인 러닝 앨범.'
                : `${meta.label} · ${meta.desc}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Tag tone="brand">BREQ PHOTO LOG</Tag>
              <Tag>{posts[0]?.course ?? 'NO ROUTE YET'}</Tag>
            </div>
          </div>

          {mine && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-[4px] bg-ink px-3 py-3 text-[13px] font-extrabold text-white"
              >
                사진 올리기
              </button>
              <button
                onClick={addFromLatestRun}
                className="rounded-[4px] border border-line bg-card px-3 py-3 text-[13px] font-extrabold text-ink"
              >
                최근 기록 추가
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) addPhoto(file)
                  e.target.value = ''
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-[2px] bg-line">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelected(post)}
              className="relative aspect-square overflow-hidden bg-card text-left"
              aria-label={`${post.title} 보기`}
            >
              {post.image ? (
                <img src={post.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <RunTile post={post} />
              )}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mx-4 mt-4 rounded-[8px] border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[16px] font-black text-ink">{selected.title}</p>
                <p className="mt-1 text-[12px] text-mute">{selected.date} · {selected.course}</p>
              </div>
              <Tag tone="brand">{selected.distanceKm ? `${selected.distanceKm.toFixed(1)}K` : 'PHOTO'}</Tag>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink/80">{selected.caption}</p>
            <div className="mt-3 grid grid-cols-2 divide-x divide-line border-y border-line py-2 text-center">
              <ProfileStat label="DISTANCE" value={selected.distanceKm ? `${selected.distanceKm.toFixed(1)}km` : '-'} />
              <ProfileStat label="PACE" value={fmtPaceKm(selected.paceSec)} />
            </div>
          </div>
        )}

        {mine && posts.length === 0 && (
          <div className="mx-4 mt-5 rounded-[8px] border border-line bg-card px-4 py-10 text-center">
            <p className="text-[14px] font-bold text-ink">아직 사진첩이 비어 있어요.</p>
            <p className="mt-1 text-[12px] text-mute">첫 러닝 인증이나 사진을 올려서 프로필을 꾸며보세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-1">
      <p className="truncate text-[15px] font-black tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[8px] font-extrabold tracking-[0.14em] text-mute">{label}</p>
    </div>
  )
}

function RunTile({ post }: { post: GalleryPost }) {
  return (
    <div
      className="flex h-full w-full flex-col justify-between p-2.5 text-white"
      style={{
        background:
          `linear-gradient(135deg, ${post.accent} 0%, #101114 62%),` +
          'repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 1px, transparent 1px 12px)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] font-extrabold tracking-[0.12em] text-white/65">
          BREQ
        </span>
        <span className="h-1.5 w-6 bg-white/80" />
      </div>
      <div>
        <p className="text-[20px] font-black leading-none tracking-[-0.03em]">
          {post.distanceKm ? post.distanceKm.toFixed(1) : 'RUN'}
        </p>
        <p className="mt-0.5 font-mono text-[8px] font-bold text-white/70">
          {post.distanceKm ? 'KM' : 'PHOTO'}
        </p>
      </div>
      <div>
        <p className="truncate text-[9px] font-extrabold">{post.title}</p>
        <p className="mt-0.5 truncate text-[8px] font-semibold text-white/60">{post.course}</p>
      </div>
    </div>
  )
}
