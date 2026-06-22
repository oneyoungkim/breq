import { useState } from 'react'
import type { Meetup, Profile } from '../types'
import { fmtPace, PACE_PRESETS } from '../logic'
import { BackHeader, Chip, Field, inputCls, Toggle } from '../components/ui'
import RegionPicker from '../components/RegionPicker'

export default function CreateMeetup({
  profile,
  onCreate,
  onBack,
}: {
  profile: Profile
  onCreate: (m: Meetup) => void
  onBack: () => void
}) {
  const [title, setTitle] = useState('')
  const [region, setRegion] = useState(profile.region)
  const [spot, setSpot] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [time, setTime] = useState('19:30')
  const [distanceKm, setDistanceKm] = useState(5)
  const [paceMin, setPaceMin] = useState<number>(390)
  const [paceMax, setPaceMax] = useState<number>(450)
  const [max, setMax] = useState(10)
  const [beginnerOk, setBeginnerOk] = useState(true)
  const [noDrop, setNoDrop] = useState(true)
  const [quiet, setQuiet] = useState(false)
  const [night, setNight] = useState(false)
  const [certRequired, setCertRequired] = useState(false)
  const [desc, setDesc] = useState('')

  const valid =
    title.trim() !== '' &&
    spot.trim() !== '' &&
    dateLabel.trim() !== '' &&
    paceMin <= paceMax &&
    distanceKm > 0 &&
    max >= 2

  const submit = () => {
    onCreate({
      id: `u${Date.now()}`,
      title: title.trim(),
      region,
      spot: spot.trim(),
      dateLabel: dateLabel.trim(),
      time,
      distanceKm,
      paceMin,
      paceMax,
      max,
      members: [profile.name],
      host: profile.name,
      hostLevel: profile.level,
      beginnerOk,
      quiet,
      noDrop,
      night,
      certRequired,
      desc: desc.trim() || '함께 달려요!',
      course: `${spot.trim()} 일대`,
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BackHeader title="모임 만들기" onBack={onBack} />
      <div className="flex-1 space-y-5 px-4 pb-32 pt-4">
        <Field label="모임 이름">
          <input
            className={inputCls}
            placeholder="예: 반포 퇴근 후 가볍게 5K"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">지역</span>
          <RegionPicker value={region} onChange={setRegion} />
        </div>

        <Field label="집결 장소">
          <input
            className={inputCls}
            placeholder="예: 반포한강공원 달빛광장"
            value={spot}
            onChange={(e) => setSpot(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="날짜">
            <input
              className={inputCls}
              placeholder="예: 6/15 (월)"
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
            />
          </Field>
          <Field label="시간">
            <input
              type="time"
              className={inputCls}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="거리 (km)">
            <input
              type="number"
              className={inputCls}
              value={distanceKm}
              min={1}
              onChange={(e) => setDistanceKm(Number(e.target.value))}
            />
          </Field>
          <Field label="최대 인원">
            <input
              type="number"
              className={inputCls}
              value={max}
              min={2}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">
            페이스 범위 — 빠른 쪽 ({fmtPace(paceMin)}/km)
          </span>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PACE_PRESETS.map((p) => (
              <Chip
                key={p.label}
                active={paceMin === p.sec}
                onClick={() => {
                  setPaceMin(p.sec)
                  if (p.sec > paceMax) setPaceMax(p.sec)
                }}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <span className="mb-1.5 mt-3 block text-[13px] font-semibold text-mute">
            페이스 범위 — 느린 쪽 ({fmtPace(paceMax)}/km)
          </span>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {PACE_PRESETS.map((p) => (
              <Chip
                key={p.label}
                active={paceMax === p.sec}
                onClick={() => {
                  setPaceMax(p.sec)
                  if (p.sec < paceMin) setPaceMin(p.sec)
                }}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card px-4 py-2">
          <Toggle
            on={beginnerOk}
            onChange={setBeginnerOk}
            label="초보 환영"
            desc="입문·슬로우러너에게 모임이 추천돼요"
          />
          <Toggle
            on={noDrop}
            onChange={setNoDrop}
            label="뒤처짐 없는 런"
            desc="스위퍼를 지정하고 다 같이 들어와요"
          />
          <Toggle
            on={quiet}
            onChange={setQuiet}
            label="조용한 모임"
            desc="대화 없이 각자 페이스에 집중해요"
          />
          <Toggle
            on={night}
            onChange={setNight}
            label="야간 안전 모드"
            desc="위치 공유 + 밝은 코스 추천"
          />
          <Toggle
            on={certRequired}
            onChange={setCertRequired}
            label="인증 필수"
            desc="완주 후 인증 카드를 올려야 해요"
          />
        </div>

        <Field label="모임 소개 (선택)">
          <textarea
            className={`${inputCls} h-24 resize-none`}
            placeholder="분위기, 준비물, 끝나고 뭐 하는지 등을 적어주세요"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-bg/95 px-4 pb-5 pt-3 backdrop-blur">
        <button
          onClick={submit}
          disabled={!valid}
          className="w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white disabled:opacity-30"
        >
          모임 만들기
        </button>
      </div>
    </div>
  )
}
