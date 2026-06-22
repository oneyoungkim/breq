import type { ReactNode } from 'react'
import type { Level } from '../types'
import { LEVEL_META } from '../logic'

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-[3px] border px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-white/75 text-mute hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Toggle({
  on,
  onChange,
  label,
  desc,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  desc?: string
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
    >
      <span>
        <span className="block text-[14px] font-bold text-ink">{label}</span>
        {desc && <span className="mt-0.5 block text-[12px] text-mute">{desc}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-[3px] transition-colors ${
          on ? 'bg-brand' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-[2px] bg-white transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function LevelBadge({ level, small }: { level: Level; small?: boolean }) {
  const meta = LEVEL_META[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] border font-extrabold uppercase ${
        small
          ? 'px-1.5 py-0.5 text-[9px] tracking-[0.08em]'
          : 'px-2 py-1 text-[10px] tracking-[0.1em]'
      }`}
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        background: `${meta.color}10`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.code}
    </span>
  )
}

export function Tag({
  children,
  tone = 'mute',
}: {
  children: ReactNode
  tone?: 'mute' | 'mint' | 'sky' | 'amber' | 'viol' | 'brand'
}) {
  const colors: Record<string, string> = {
    mute: 'text-mute bg-card2',
    mint: 'text-mint bg-mint/10',
    sky: 'text-sky bg-sky/10',
    amber: 'text-route bg-route/10',
    viol: 'text-viol bg-viol/10',
    brand: 'text-brand bg-brand/10',
  }
  return (
    <span
      className={`rounded-[2px] px-1.5 py-[3px] text-[10px] font-extrabold tracking-[0.04em] ${colors[tone]}`}
    >
      {children}
    </span>
  )
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-mute">
        {children}
      </h2>
      {right}
    </div>
  )
}

export function BackHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-3 py-3 backdrop-blur">
      <button
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-card text-[18px] text-ink"
        aria-label="뒤로"
      >
        ←
      </button>
      <h1 className="flex-1 truncate text-[14px] font-extrabold tracking-[0.02em] text-ink">
        {title}
      </h1>
      {right}
    </div>
  )
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hues = [14, 152, 200, 262, 45, 330]
  let h = 0
  for (const ch of name) h = (h + ch.charCodeAt(0)) % hues.length
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[3px] font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hues[h]} 45% 38%)`,
      }}
    >
      {name.slice(0, 1)}
    </span>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.1em] text-mute">
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-[3px] border border-line bg-card px-3.5 py-3 text-[15px] text-ink placeholder:text-mute/50 outline-none focus:border-ink/60'
