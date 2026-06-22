import { useState } from 'react'
import type { Profile } from '../types'
import { classify, fmtPaceKm, LEVEL_META, PACE_PRESETS } from '../logic'
import { Chip, inputCls } from '../components/ui'
import RegionPicker from '../components/RegionPicker'

const DISTANCES = ['3km', '5km', '10km', '하프 이상']
const PURPOSES = ['다이어트', '건강', '대회 준비', '친목', '스트레스 해소']
const STYLES = ['혼자 뛰기', '같이 뛰기', '말하면서 뛰기', '조용히 뛰기']

const LEVEL_PERKS: Record<string, string[]> = {
  slow: [
    '"오늘도 나갔다" 인증 카드',
    '걷뛰 루틴 · 20분 완주 챌린지',
    '출석률 중심 랭킹 (페이스 안 봐요)',
    '천천히 뛰는 모임만 골라 추천',
  ],
  easy: [
    '내 페이스에 맞는 동네 모임 추천',
    '대화하며 뛰는 친목런 매칭',
    '꾸준함 배지와 주간 리포트',
    '부상 방지 콘텐츠',
  ],
  tempo: [
    '페이스 개선 그래프',
    '인터벌 · 템포런 모임 추천',
    '구간별 기록 분석',
    '비슷한 기록대 러너 비교',
  ],
  racer: [
    '대회 목표 설정 & PB 트래킹',
    '대회 준비 훈련 플랜',
    '빠른 페이스 그룹런 매칭',
    '구간별 기록 분석',
  ],
}

export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [paceSec, setPaceSec] = useState<number | null>(null)
  const [paceChoice, setPaceChoice] = useState<string>('') // preset label | 'walkrun' | 'unknown'
  const [distances, setDistances] = useState<string[]>([])
  const [purposes, setPurposes] = useState<string[]>([])
  const [styles, setStyles] = useState<string[]>([])

  const walkRun = paceChoice === 'walkrun'
  const level = classify(paceSec, walkRun)
  const meta = LEVEL_META[level]

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const canNext = [
    name.trim().length > 0 && region !== '',
    paceChoice !== '',
    distances.length > 0,
    purposes.length > 0,
    styles.length > 0,
    true,
  ][step]

  const TOTAL = 6

  const next = () => {
    if (step === TOTAL - 1) {
      onDone({
        name: name.trim(),
        region,
        paceSec,
        walkRun,
        distances,
        purposes,
        styles,
        level,
      })
    } else setStep(step + 1)
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-6">
      {/* progress */}
      <div className="mb-6 flex items-center gap-2">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="text-[18px] text-mute">
            ←
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div>
            <h1 className="text-[22px] font-extrabold leading-snug text-ink">
              어떻게 불러드릴까요?
            </h1>
            <p className="mt-1.5 text-[13px] text-mute">
              닉네임과 주로 달리는 동네를 알려주세요.
            </p>
            <div className="mt-6 space-y-5">
              <input
                className={inputCls}
                placeholder="닉네임 (예: 달리는수박)"
                value={name}
                maxLength={12}
                onChange={(e) => setName(e.target.value)}
              />
              <div>
                <span className="mb-2 block text-[13px] font-semibold text-mute">
                  주 러닝 지역
                </span>
                <RegionPicker value={region} onChange={setRegion} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-[22px] font-extrabold leading-snug text-ink">
              평소 페이스는 어느 정도인가요?
            </h1>
            <p className="mt-1.5 text-[13px] text-mute">
              1km를 도는 데 걸리는 시간이에요. 대략이면 충분해요.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {PACE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setPaceSec(p.sec)
                    setPaceChoice(p.label)
                  }}
                  className={`rounded-xl border py-3 text-[15px] font-bold transition-colors ${
                    paceChoice === p.label
                      ? 'border-brand bg-brand/15 text-brand'
                      : 'border-line bg-card text-ink'
                  }`}
                >
                  {p.label}
                  <span className="block text-[10px] font-medium text-mute">/km</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {[
                { key: 'walkrun', label: '걷뛰 위주예요 (걷기+뛰기)' },
                { key: 'unknown', label: '아직 잘 몰라요' },
              ].map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setPaceSec(null)
                    setPaceChoice(o.key)
                  }}
                  className={`w-full rounded-xl border py-3 text-[14px] font-bold transition-colors ${
                    paceChoice === o.key
                      ? 'border-mint bg-mint/10 text-mint'
                      : 'border-line bg-card text-mute'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-mute/80">
              느려도 괜찮아요. BREQ는 페이스로 차별하지 않아요.
            </p>
          </div>
        )}

        {step === 2 && (
          <MultiStep
            title="주로 어느 거리를 달리세요?"
            sub="여러 개 골라도 돼요."
            options={DISTANCES}
            selected={distances}
            onToggle={(v) => toggle(distances, setDistances, v)}
          />
        )}
        {step === 3 && (
          <MultiStep
            title="러닝의 목적은 무엇인가요?"
            sub="목적에 맞는 모임과 플랜을 추천해 드려요."
            options={PURPOSES}
            selected={purposes}
            onToggle={(v) => toggle(purposes, setPurposes, v)}
          />
        )}
        {step === 4 && (
          <MultiStep
            title="어떤 스타일로 달리는 게 좋아요?"
            sub="성향이 비슷한 러너와 매칭해 드려요."
            options={STYLES}
            selected={styles}
            onToggle={(v) => toggle(styles, setStyles, v)}
          />
        )}

        {step === 5 && (
          <div className="pt-4">
            <p className="eyebrow">{name} · YOUR LEVEL</p>
            <h1
              className="mt-4 text-[40px] font-black leading-[0.95] tracking-[-0.02em]"
              style={{ color: meta.color }}
            >
              {meta.code.split(' ').map((w) => (
                <span key={w} className="block">
                  {w}
                </span>
              ))}
            </h1>
            <p className="mt-3 text-[15px] font-bold text-ink">
              {meta.label} — {meta.desc}
            </p>
            {paceSec != null && (
              <p className="mt-1 text-[13px] tabular-nums text-mute">
                AVG PACE {fmtPaceKm(paceSec)}
              </p>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-mute">{meta.sub}</p>
            <div className="mt-6 border-t border-line pt-4">
              <p className="eyebrow mb-3">PERSONALIZED FOR YOU</p>
              <ul className="space-y-2.5">
                {LEVEL_PERKS[level].map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[13px] text-ink/85">
                    <span className="font-bold" style={{ color: meta.color }}>
                      —
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={next}
        disabled={!canNext}
        className="mt-6 w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white transition-opacity disabled:opacity-30"
      >
        {step === TOTAL - 1 ? 'BREQ 시작하기' : '다음'}
      </button>
    </div>
  )
}

function MultiStep({
  title,
  sub,
  options,
  selected,
  onToggle,
}: {
  title: string
  sub: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div>
      <h1 className="text-[22px] font-extrabold leading-snug text-ink">{title}</h1>
      <p className="mt-1.5 text-[13px] text-mute">{sub}</p>
      <div className="mt-6 space-y-2.5">
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-[15px] font-semibold transition-colors ${
                on ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-card text-mute'
              }`}
            >
              {o}
              <span className={on ? 'text-brand' : 'text-line'}>✓</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
