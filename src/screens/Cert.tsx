import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CardRatio,
  CardTheme,
  CertTemplate,
  GeoPoint,
  Profile,
  RunInput,
  RunRecord,
} from '../types'
import { calcPace, fmtPace, hashtags } from '../logic'
import { allRecentRuns, fmtClock, SOURCE_META } from '../runs'
import { isPro } from '../aiCoach'
import { CREW } from '../data'
import { Field, inputCls, SectionTitle, Toggle } from '../components/ui'

/* ──────────────────────────────────────────────────────────────
   BREQ 인증카드 드로잉 시스템
   - 해상도 독립: 모든 치수는 u = W/1080 로 스케일 → 9:16·4:5·썸네일 동일 코드
   - 미리보기 캔버스 = 저장 결과 (같은 drawCard 사용)
   ────────────────────────────────────────────────────────────── */

const RATIOS: Record<CardRatio, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
}

type Pal = {
  fg: string
  dim: string
  faint: string
  accent: string
  line: string
  panel: string
  onAccent: string
  coreBg: string
}

const PALETTES: Record<CardTheme, Pal> = {
  light: {
    fg: '#0E0F12',
    dim: 'rgba(14,15,18,0.62)',
    faint: 'rgba(14,15,18,0.40)',
    accent: '#1B3AC0',
    line: 'rgba(14,15,18,0.14)',
    panel: 'rgba(14,15,18,0.05)',
    onAccent: '#FFFFFF',
    coreBg: '#F1EFE8',
  },
  dark: {
    fg: '#F5F4EF',
    dim: 'rgba(245,244,239,0.66)',
    faint: 'rgba(245,244,239,0.42)',
    accent: '#6E8FFF',
    line: 'rgba(255,255,255,0.16)',
    panel: 'rgba(255,255,255,0.07)',
    onAccent: '#0E0F12',
    coreBg: '#0E0F12',
  },
  blue: {
    fg: '#FFFFFF',
    dim: 'rgba(255,255,255,0.76)',
    faint: 'rgba(255,255,255,0.52)',
    accent: '#FFFFFF',
    line: 'rgba(255,255,255,0.22)',
    panel: 'rgba(255,255,255,0.10)',
    onAccent: '#0B1A4A',
    coreBg: '#0B1A4A',
  },
  photo: {
    fg: '#FFFFFF',
    dim: 'rgba(255,255,255,0.82)',
    faint: 'rgba(255,255,255,0.60)',
    accent: '#FFFFFF',
    line: 'rgba(255,255,255,0.28)',
    panel: 'rgba(0,0,0,0.34)',
    onAccent: '#0E0F12',
    coreBg: 'rgba(0,0,0,0.55)',
  },
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  theme: CardTheme,
  photo: HTMLImageElement | null,
  W: number,
  H: number,
) {
  const u = W / 1080
  if (theme === 'photo') {
    if (photo) {
      const scale = Math.max(W / photo.width, H / photo.height)
      const dw = photo.width * scale
      const dh = photo.height * scale
      ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh)
    }
    const t = ctx.createLinearGradient(0, 0, 0, H * 0.32)
    t.addColorStop(0, 'rgba(0,0,0,0.55)')
    t.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = t
    ctx.fillRect(0, 0, W, H * 0.32)
    const b = ctx.createLinearGradient(0, H * 0.5, 0, H)
    b.addColorStop(0, 'rgba(0,0,0,0)')
    b.addColorStop(1, 'rgba(0,0,0,0.84)')
    ctx.fillStyle = b
    ctx.fillRect(0, H * 0.5, W, H * 0.5)
    return
  }
  if (theme === 'blue') {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#11267A')
    g.addColorStop(1, '#060F2C')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } else if (theme === 'dark') {
    ctx.fillStyle = '#0E0F12'
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = '#F1EFE8'
    ctx.fillRect(0, 0, W, H)
  }
  // 데이터 그리드 — 아주 옅게
  ctx.strokeStyle = theme === 'light' ? 'rgba(14,15,18,0.05)' : 'rgba(255,255,255,0.055)'
  ctx.lineWidth = 1 * u
  const step = W / 6
  for (let x = step; x < W; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = step; y < H; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

export interface MonthlyAgg {
  km: number
  count: number
  paceSec: number | null
  tracks: GeoPoint[][]
  label: string // 예: 2026.06
}

export type DrawOpts = {
  template: CertTemplate
  theme: CardTheme
  ratio: CardRatio
  run: RunInput
  paceSec: number | null
  dateStr: string
  photo: HTMLImageElement | null
  monthly: MonthlyAgg
}

function drawCard(canvas: HTMLCanvasElement, opts: DrawOpts) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  const u = W / 1080
  ctx.clearRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  const { run, paceSec, dateStr, photo, monthly } = opts
  const pal = PALETTES[opts.theme]
  const bgTheme: CardTheme = opts.theme === 'photo' && !photo ? 'dark' : opts.theme
  paintBackground(ctx, bgTheme, photo, W, H)

  // ── 타이포 헬퍼 ──
  const disp = (s: number, w = 900) =>
    `${w} ${s * u}px "Pretendard Variable", Pretendard, sans-serif`
  const mono = (s: number, w = 600) =>
    `${w} ${s * u}px "JetBrains Mono", ui-monospace, monospace`

  const m = 84 * u
  const cx = W / 2
  const contentW = W - 2 * m
  const top = m + 64 * u
  const bot = H - m - 56 * u
  const ch = bot - top

  // 포맷
  const totalSec = run.minutes * 60 + run.seconds
  const dKm = run.distanceKm || 0
  const distStr = dKm.toFixed(2)
  const timeStr = fmtClock(totalSec)
  const paceStr = run.walkRun ? '걷뛰' : paceSec ? fmtPace(paceSec) : '--'
  const paceUnit = run.walkRun ? '' : '/KM'
  const seed = Math.round(dKm * 73 + run.minutes * 31 + run.seconds + 7) % 99991

  // 스플릿 (없으면 시드 기반 생성)
  const splits =
    run.splits && run.splits.length > 1
      ? run.splits
      : (() => {
          const n = Math.max(4, Math.min(8, Math.round(dKm) || 5))
          const base = paceSec ?? 360
          const r = rng(seed)
          return Array.from({ length: n }, (_, i) =>
            Math.round(base * (1 + Math.sin(i * 0.9 + 1) * 0.05 + (r() - 0.5) * 0.05)),
          )
        })()

  // ── 공용 드로잉 헬퍼 ──
  // 한글이 섞이면 모노(JetBrains)에 한글 글리프가 없으므로 Pretendard로 그린다
  const isKo = (t: string) => /[㄰-㆏가-힣]/.test(t)
  const labelFont = (t: string, size: number, weight: number) =>
    isKo(t) ? disp(size, Math.max(weight, 600)) : mono(size, weight)

  const tlabel = (
    text: string,
    x: number,
    y: number,
    o: { size?: number; align?: 'left' | 'center' | 'right'; color?: string; weight?: number; ls?: number } = {},
  ) => {
    const { size = 24, align = 'left', color = pal.dim, weight = 600, ls = 4 } = o
    ctx.font = labelFont(text, size, weight)
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    const sp = ls * u
    let total = 0
    for (const chx of text) total += ctx.measureText(chx).width + sp
    total -= sp
    let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
    for (const chx of text) {
      ctx.fillText(chx, px, y)
      px += ctx.measureText(chx).width + sp
    }
  }

  const bigVal = (
    value: string,
    unit: string,
    x: number,
    y: number,
    o: { vSize?: number; uSize?: number; align?: 'left' | 'center' | 'right'; vColor?: string; uColor?: string; weight?: number } = {},
  ) => {
    const { vSize = 200, align = 'left', vColor = pal.fg, uColor = pal.dim, weight = 900 } = o
    const uSize = o.uSize ?? vSize * 0.3
    ctx.font = disp(vSize, weight)
    const vw = ctx.measureText(value).width
    let uw = 0
    if (unit) {
      ctx.font = disp(uSize, 800)
      uw = ctx.measureText(unit).width + 12 * u
    }
    const total = vw + uw
    const sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
    ctx.textAlign = 'left'
    ctx.fillStyle = vColor
    ctx.font = disp(vSize, weight)
    ctx.fillText(value, sx, y)
    if (unit) {
      ctx.fillStyle = uColor
      ctx.font = disp(uSize, 800)
      ctx.fillText(unit, sx + vw + 12 * u, y)
    }
  }

  const fitSize = (text: string, maxW: number, base: number, weight = 900) => {
    let s = base
    ctx.font = disp(s, weight)
    while (ctx.measureText(text).width > maxW && s > 24) {
      s -= 4
      ctx.font = disp(s, weight)
    }
    return s
  }

  const wordmark = (
    x: number,
    y: number,
    o: { size?: number; align?: 'left' | 'center' | 'right'; color?: string } = {},
  ) => {
    const { size = 40, align = 'left', color = pal.fg } = o
    ctx.font = disp(size, 900)
    const w = ctx.measureText('BREQ').width
    const dotR = size * 0.13 * u
    const total = w + dotR * 3
    const sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
    ctx.textAlign = 'left'
    ctx.fillStyle = color
    ctx.font = disp(size, 900)
    ctx.fillText('BREQ', sx, y)
    ctx.beginPath()
    ctx.arc(sx + w + dotR * 1.8, y - dotR * 0.1, dotR, 0, Math.PI * 2)
    ctx.fillStyle = pal.accent
    ctx.fill()
  }

  const badge = (
    text: string,
    x: number,
    y: number,
    o: { size?: number; align?: 'left' | 'center' | 'right'; fill?: string; color?: string; outline?: boolean } = {},
  ) => {
    const { size = 24, align = 'left', fill = pal.accent, color = pal.onAccent, outline = false } = o
    ctx.font = labelFont(text, size, 700)
    const padX = 22 * u
    const padY = 14 * u
    const tw = ctx.measureText(text).width + (text.length - 1) * 2 * u
    const bw = tw + padX * 2
    const bh = size * u + padY * 2
    const sx = align === 'center' ? x - bw / 2 : align === 'right' ? x - bw : x
    rr(ctx, sx, y, bw, bh, 7 * u)
    if (outline) {
      ctx.strokeStyle = fill
      ctx.lineWidth = 2.5 * u
      ctx.stroke()
      tlabel(text, sx + padX, y + bh / 2 + size * 0.36 * u, { size, color: fill, ls: 2, weight: 700 })
    } else {
      ctx.fillStyle = fill
      ctx.fill()
      tlabel(text, sx + padX, y + bh / 2 + size * 0.36 * u, { size, color, ls: 2, weight: 700 })
    }
    return { w: bw, h: bh }
  }

  const route = (
    x: number,
    y: number,
    w: number,
    h: number,
    o: { color?: string; lw?: number; glow?: boolean; markers?: boolean } = {},
  ) => {
    const { color = pal.accent, lw = 12, glow = true, markers = true } = o

    // 실제 GPS 트랙이 있으면 그걸 정확한 축척으로 그린다
    const real = run.track
    if (real && real.length >= 2) {
      const meanLat = real.reduce((s, p) => s + p.lat, 0) / real.length
      const kx = Math.cos((meanLat * Math.PI) / 180)
      const P = real.map((p) => ({ x: p.lng * kx, y: -p.lat }))
      const xs = P.map((p) => p.x)
      const ys = P.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const spanX = Math.max(...xs) - minX || 1e-9
      const spanY = Math.max(...ys) - minY || 1e-9
      const pad = lw * 2 * u
      const sc = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
      const offX = x + (w - spanX * sc) / 2
      const offY = y + (h - spanY * sc) / 2
      const sx = (vx: number) => offX + (vx - minX) * sc
      const sy = (vy: number) => offY + (vy - minY) * sc
      if (glow) {
        ctx.save()
        ctx.shadowColor = color
        ctx.shadowBlur = 26 * u
      }
      ctx.strokeStyle = color
      ctx.lineWidth = lw * u
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx(P[0].x), sy(P[0].y))
      for (let i = 1; i < P.length; i++) ctx.lineTo(sx(P[i].x), sy(P[i].y))
      ctx.stroke()
      if (glow) ctx.restore()
      if (markers) {
        const s0 = P[0]
        const e0 = P[P.length - 1]
        ctx.beginPath()
        ctx.arc(sx(s0.x), sy(s0.y), 16 * u, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.beginPath()
        ctx.arc(sx(s0.x), sy(s0.y), 8 * u, 0, Math.PI * 2)
        ctx.fillStyle = pal.coreBg
        ctx.fill()
        ctx.beginPath()
        ctx.arc(sx(e0.x), sy(e0.y), 22 * u, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 5 * u
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(sx(e0.x), sy(e0.y), 12 * u, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
      return
    }

    const r = rng(seed)
    const n = 14
    const pts: [number, number][] = Array.from({ length: n }, (_, i) => {
      const yy = y + h * (0.5 + Math.sin(i * 0.8 + seed) * 0.3 + (r() - 0.5) * 0.28)
      return [x + w * (i / (n - 1)), Math.max(y + lw * u, Math.min(y + h - lw * u, yy))]
    })
    if (glow) {
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 26 * u
    }
    ctx.strokeStyle = color
    ctx.lineWidth = lw * u
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2
      const my = (pts[i][1] + pts[i + 1][1]) / 2
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1])
    ctx.stroke()
    if (glow) ctx.restore()
    if (markers) {
      const start = pts[0]
      const fin = pts[n - 1]
      // start (속 빈 링)
      ctx.beginPath()
      ctx.arc(start[0], start[1], 16 * u, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.beginPath()
      ctx.arc(start[0], start[1], 8 * u, 0, Math.PI * 2)
      ctx.fillStyle = pal.coreBg
      ctx.fill()
      // finish (꽉 찬 + 외곽 링)
      ctx.beginPath()
      ctx.arc(fin[0], fin[1], 22 * u, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 5 * u
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(fin[0], fin[1], 12 * u, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }

  const paceGraph = (
    x: number,
    y: number,
    w: number,
    h: number,
    data: number[],
    o: { color?: string } = {},
  ) => {
    const { color = pal.accent } = o
    if (data.length < 2) return
    const min = Math.min(...data)
    const max = Math.max(...data)
    const span = Math.max(max - min, 1)
    const X = (i: number) => x + w * (i / (data.length - 1))
    const Y = (v: number) => y + h * ((v - min) / span) // 빠를수록(작을수록) 위
    // 바닥 축
    ctx.strokeStyle = pal.line
    ctx.lineWidth = 1.5 * u
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x + w, y + h)
    ctx.stroke()
    // 면
    ctx.beginPath()
    ctx.moveTo(X(0), y + h)
    data.forEach((v, i) => ctx.lineTo(X(i), Y(v)))
    ctx.lineTo(X(data.length - 1), y + h)
    ctx.closePath()
    ctx.globalAlpha = 0.16
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
    // 선
    ctx.beginPath()
    data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
    ctx.strokeStyle = color
    ctx.lineWidth = 6 * u
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    // 최고 구간 점
    const fi = data.indexOf(min)
    ctx.beginPath()
    ctx.arc(X(fi), Y(min), 12 * u, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(X(fi), Y(min), 5 * u, 0, Math.PI * 2)
    ctx.fillStyle = pal.coreBg
    ctx.fill()
  }

  const header = (eyebrow?: string, eyebrowColor?: string) => {
    wordmark(m, m + 30 * u, { size: 40 })
    if (eyebrow) tlabel(eyebrow, W - m, m + 26 * u, { size: 24, align: 'right', color: eyebrowColor ?? pal.dim, ls: 6 })
    else tlabel(dateStr, W - m, m + 26 * u, { size: 23, align: 'right', color: pal.dim, ls: 3 })
  }

  const footer = (text = 'BEST RUN EVER QUEST') =>
    tlabel(text, cx, H - m + 16 * u, { size: 20, align: 'center', color: pal.faint, ls: 7 })

  const hairline = (y: number, x0 = m, x1 = W - m) => {
    ctx.strokeStyle = pal.line
    ctx.lineWidth = 1.5 * u
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
  }

  // ── 템플릿 ──
  const tplMinimal = () => {
    header()
    hairline(m + 54 * u)
    tlabel('DISTANCE', m, top + ch * 0.14, { size: 26, color: pal.dim, ls: 6 })
    bigVal(distStr, 'KM', m, top + ch * 0.14 + 190 * u, { vSize: 212, uSize: 64 })
    tlabel('FIND YOUR OWN PACE', cx, top + ch * 0.58, { size: 24, align: 'center', color: pal.faint, ls: 8 })
    const triY = bot - 22 * u
    const labY = triY - 80 * u
    hairline(labY - 64 * u)
    const cols: [string, string, string][] = [
      ['PACE', paceStr, paceUnit],
      ['TIME', timeStr, ''],
      ['AVG HR', run.avgHr ? String(run.avgHr) : '--', run.avgHr ? 'BPM' : ''],
    ]
    const colW = contentW / 3
    cols.forEach((c, i) => {
      const xi = m + colW * i
      tlabel(c[0], xi, labY, { size: 22, color: pal.dim, ls: 4 })
      bigVal(c[1], c[2], xi, triY, { vSize: 62, uSize: 26 })
      if (i > 0) {
        ctx.strokeStyle = pal.line
        ctx.lineWidth = 1.5 * u
        ctx.beginPath()
        ctx.moveTo(xi - 26 * u, labY - 30 * u)
        ctx.lineTo(xi - 26 * u, triY + 6 * u)
        ctx.stroke()
      }
    })
    footer()
  }

  const tplRoute = () => {
    header()
    const ry = top + ch * 0.1
    const rh = ch * 0.46
    tlabel('ROUTE', m, ry - 16 * u, { size: 24, color: pal.dim, ls: 6 })
    route(m, ry, contentW, rh, { lw: 13 })
    const baseY = bot - 20 * u
    hairline(baseY - 188 * u)
    tlabel('DISTANCE', m, baseY - 150 * u, { size: 24, color: pal.dim, ls: 5 })
    bigVal(distStr, 'KM', m, baseY, { vSize: 150, uSize: 50 })
    const xr = W - m
    tlabel('PACE', xr, baseY - 150 * u, { size: 22, align: 'right', color: pal.dim, ls: 4 })
    bigVal(paceStr, paceUnit, xr, baseY - 92 * u, { vSize: 56, uSize: 24, align: 'right' })
    tlabel('TIME', xr, baseY - 60 * u, { size: 22, align: 'right', color: pal.dim, ls: 4 })
    bigVal(timeStr, '', xr, baseY, { vSize: 56, align: 'right' })
    footer()
  }

  const tplPhoto = () => {
    wordmark(m, m + 30 * u, { size: 40 })
    tlabel(dateStr, W - m, m + 26 * u, { size: 23, align: 'right', color: pal.dim, ls: 3 })
    const gy = H - m
    tlabel('BEST RUN EVER QUEST', W - m, gy + 16 * u, { size: 18, align: 'right', color: pal.faint, ls: 5 })
    if (run.courseName)
      tlabel(run.courseName.toUpperCase(), m, gy + 16 * u, { size: 20, color: pal.dim, ls: 3 })
    const rowValY = gy - 70 * u
    const rowLabY = rowValY - 50 * u
    const cols: [string, string, string][] = [
      ['PACE', paceStr, paceUnit],
      ['TIME', timeStr, ''],
    ]
    cols.forEach((c, i) => {
      const x = m + i * 300 * u
      tlabel(c[0], x, rowLabY, { size: 22, color: pal.dim, ls: 4 })
      bigVal(c[1], c[2], x, rowValY, { vSize: 54, uSize: 24 })
    })
    const distValY = rowLabY - 74 * u
    const distLabY = distValY - 150 * u
    tlabel('DISTANCE', m, distLabY, { size: 26, color: pal.dim, ls: 5 })
    bigVal(distStr, 'KM', m, distValY, { vSize: 176, uSize: 56 })
  }

  const tplPride = () => {
    header()
    const sy = top + ch * 0.26
    ctx.textAlign = 'left'
    ctx.fillStyle = pal.fg
    ctx.font = disp(118, 900)
    ctx.fillText('오늘도,', m, sy)
    ctx.fillText('달렸다', m, sy + 130 * u)
    const w2 = ctx.measureText('달렸다').width
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 12 * u
    ctx.beginPath()
    ctx.moveTo(m, sy + 156 * u)
    ctx.lineTo(m + w2, sy + 156 * u)
    ctx.stroke()
    tlabel('가장 빠른 기록이 아니라, 내 페이스를 찾는 일', m, sy + 224 * u, {
      size: 22,
      color: pal.dim,
      ls: 2,
    })
    // 주간 꾸준함 (그리드)
    const sqY = top + ch * 0.66
    tlabel('THIS WEEK', m, sqY - 26 * u, { size: 20, color: pal.dim, ls: 4 })
    const filled = [1, 1, 1, 0, 1, 1, 0]
    const sq = 58 * u
    const gap = 20 * u
    filled.forEach((f, i) => {
      const xx = m + i * (sq + gap)
      rr(ctx, xx, sqY, sq, sq, 8 * u)
      if (f) {
        ctx.fillStyle = pal.accent
        ctx.fill()
      } else {
        ctx.strokeStyle = pal.line
        ctx.lineWidth = 2.5 * u
        ctx.stroke()
      }
    })
    // 하단: 거리 + 시간 (페이스 강조 X)
    const baseY = bot - 20 * u
    hairline(baseY - 150 * u)
    tlabel('DISTANCE', m, baseY - 78 * u, { size: 22, color: pal.dim, ls: 4 })
    bigVal(distStr, 'KM', m, baseY, { vSize: 64, uSize: 26 })
    tlabel('TIME', m + contentW * 0.52, baseY - 78 * u, { size: 22, color: pal.dim, ls: 4 })
    bigVal(timeStr, '', m + contentW * 0.52, baseY, { vSize: 64 })
    badge('완주', W - m, top + ch * 0.66, { align: 'right', size: 24 })
    footer()
  }

  const tplCrew = () => {
    header()
    const name = (run.crewName || 'RUN CREW').toUpperCase()
    const ny = top + ch * 0.28
    const ns = fitSize(name, contentW, 92, 900)
    ctx.textAlign = 'center'
    ctx.fillStyle = pal.fg
    ctx.font = disp(ns, 900)
    ctx.fillText(name, cx, ny)
    tlabel(run.courseName ? run.courseName.toUpperCase() : 'GROUP RUN', cx, ny + 56 * u, {
      size: 24,
      align: 'center',
      color: pal.dim,
      ls: 4,
    })
    // 2×2 그리드
    const gy = top + ch * 0.56
    const gh = ch * 0.36
    const colW = contentW / 2
    const rowH = gh / 2
    const cells: [string, string, string][] = [
      ['RUNNERS', run.crewMembers ? String(run.crewMembers) : '—', ''],
      ['AVG PACE', paceStr, paceUnit],
      ['DISTANCE', distStr, 'KM'],
      ['TIME', timeStr, ''],
    ]
    cells.forEach((c, i) => {
      const xi = m + (i % 2) * colW
      const yi = gy + Math.floor(i / 2) * rowH
      tlabel(c[0], xi, yi + 36 * u, { size: 20, color: pal.dim, ls: 3 })
      bigVal(c[1], c[2], xi, yi + 104 * u, { vSize: 60, uSize: 24 })
    })
    ctx.strokeStyle = pal.line
    ctx.lineWidth = 1.5 * u
    ctx.beginPath()
    ctx.moveTo(m + colW, gy + 6 * u)
    ctx.lineTo(m + colW, gy + gh - 6 * u)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(m, gy + rowH)
    ctx.lineTo(m + contentW, gy + rowH)
    ctx.stroke()
    footer('BREQ RUN CREW')
  }

  const tplRace = () => {
    wordmark(m, m + 30 * u, { size: 40 })
    tlabel('RACE', W - m, m + 26 * u, { size: 24, align: 'right', color: pal.accent, ls: 8 })
    // 강한 액센트 바
    ctx.fillStyle = pal.accent
    ctx.fillRect(m, m + 50 * u, 88 * u, 8 * u)
    if (run.isPB) badge(run.pbKind || 'PB', W - m, m + 58 * u, { align: 'right', size: 26 })
    tlabel('FINISH TIME', cx, top + ch * 0.16, { size: 26, align: 'center', color: pal.dim, ls: 6 })
    bigVal(timeStr, '', cx, top + ch * 0.16 + 180 * u, {
      vSize: timeStr.length > 5 ? 184 : 224,
      align: 'center',
    })
    // 페이스 그래프
    const gY = top + ch * 0.5
    const gH = ch * 0.22
    tlabel('SPLITS / PACE', m, gY - 18 * u, { size: 22, color: pal.dim, ls: 4 })
    paceGraph(m, gY, contentW, gH, splits)
    // 하단 거리 + 평균 페이스
    const baseY = bot - 20 * u
    hairline(baseY - 150 * u)
    tlabel('DISTANCE', m, baseY - 78 * u, { size: 22, color: pal.dim, ls: 4 })
    bigVal(distStr, 'KM', m, baseY, { vSize: 64, uSize: 26 })
    tlabel('AVG PACE', W - m, baseY - 78 * u, { size: 22, align: 'right', color: pal.dim, ls: 4 })
    bigVal(paceStr, paceUnit, W - m, baseY, { vSize: 64, uSize: 26, align: 'right' })
    footer()
  }

  // 작은 루트 한 개를 정확 축척으로 박스에 맞춰 그린다(월간 콜라주용)
  const miniRoute = (track: GeoPoint[], bx: number, by: number, bw: number, bh: number) => {
    const pad = 12 * u
    const meanLat = track.reduce((s, p) => s + p.lat, 0) / track.length
    const kx = Math.cos((meanLat * Math.PI) / 180)
    const P = track.map((p) => ({ x: p.lng * kx, y: -p.lat }))
    const xs = P.map((p) => p.x)
    const ys = P.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(...xs) - minX || 1e-9
    const spanY = Math.max(...ys) - minY || 1e-9
    const sc = Math.min((bw - 2 * pad) / spanX, (bh - 2 * pad) / spanY)
    const ox = bx + (bw - spanX * sc) / 2
    const oy = by + (bh - spanY * sc) / 2
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 3 * u
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ox + (P[0].x - minX) * sc, oy + (P[0].y - minY) * sc)
    for (let i = 1; i < P.length; i++) ctx.lineTo(ox + (P[i].x - minX) * sc, oy + (P[i].y - minY) * sc)
    ctx.stroke()
  }

  // ── 월간 누적 마일리지 (PRO 전용) — 이달 뛴 루트를 모아 보여주는 고급 카드 ──
  const tplMonthly = () => {
    header(monthly.label, pal.accent)
    tlabel('THIS MONTH', m, top + 10 * u, { size: 23, color: pal.accent, ls: 8 })
    tlabel('월간 누적 마일리지', m, top + 46 * u, { size: 26, color: pal.dim, ls: 2 })
    bigVal(monthly.km.toFixed(1), 'KM', m, top + 236 * u, { vSize: 224, uSize: 66 })

    const sy0 = top + 312 * u
    hairline(sy0 - 38 * u)
    const cols: [string, string, string][] = [
      ['RUNS', String(monthly.count), ''],
      ['AVG PACE', monthly.paceSec ? fmtPace(monthly.paceSec) : '--', monthly.paceSec ? '/KM' : ''],
      ['ROUTES', String(monthly.tracks.length), ''],
    ]
    const colW = contentW / 3
    cols.forEach((c, i) => {
      const xi = m + colW * i
      tlabel(c[0], xi, sy0, { size: 22, color: pal.dim, ls: 4 })
      bigVal(c[1], c[2], xi, sy0 + 64 * u, { vSize: 58, uSize: 24 })
      if (i > 0) {
        ctx.strokeStyle = pal.line
        ctx.lineWidth = 1.5 * u
        ctx.beginPath()
        ctx.moveTo(xi - 26 * u, sy0 - 26 * u)
        ctx.lineTo(xi - 26 * u, sy0 + 70 * u)
        ctx.stroke()
      }
    })

    const gy = sy0 + 134 * u
    tlabel('이달의 루트', m, gy, { size: 22, color: pal.dim, ls: 4 })
    const gy0 = gy + 28 * u
    const gh = bot - gy0
    const valid = monthly.tracks.filter((t) => t.length >= 2)
    if (valid.length === 0) {
      rr(ctx, m, gy0, contentW, gh, 10 * u)
      ctx.strokeStyle = pal.line
      ctx.lineWidth = 1.5 * u
      ctx.stroke()
      tlabel('BREQ로 측정한 루트가 모일수록', cx, gy0 + gh / 2 - 6 * u, {
        size: 22,
        align: 'center',
        color: pal.faint,
        ls: 1,
      })
      tlabel('이 카드가 채워져요', cx, gy0 + gh / 2 + 30 * u, {
        size: 22,
        align: 'center',
        color: pal.faint,
        ls: 1,
      })
    } else {
      const cols2 = 3
      const gap = 16 * u
      const cellW = (contentW - gap * (cols2 - 1)) / cols2
      const rows = Math.max(1, Math.floor((gh + gap) / (cellW + gap)))
      const max = Math.min(valid.length, cols2 * rows)
      for (let i = 0; i < max; i++) {
        const cxi = i % cols2
        const ryi = Math.floor(i / cols2)
        const bx = m + cxi * (cellW + gap)
        const by = gy0 + ryi * (cellW + gap)
        rr(ctx, bx, by, cellW, cellW, 8 * u)
        ctx.fillStyle = pal.coreBg
        ctx.fill()
        ctx.strokeStyle = pal.line
        ctx.lineWidth = 1.5 * u
        ctx.stroke()
        miniRoute(valid[i], bx, by, cellW, cellW)
      }
    }
  }

  switch (opts.template) {
    case 'minimal':
      tplMinimal()
      break
    case 'route':
      tplRoute()
      break
    case 'photo':
      tplPhoto()
      break
    case 'pride':
      tplPride()
      break
    case 'crew':
      tplCrew()
      break
    case 'race':
      tplRace()
      break
    case 'monthly':
      tplMonthly()
      break
  }

  // 측정 소스 검증 라인 — 어떤 기기로 측정했는지(애플워치/가민/BREQ) 박아 조작 방지를 시각화.
  // 모든 템플릿 공통, 하단 여백(content bot=H-m-56u 아래, footer=H-m+16u 위)에 1회만.
  const CERT_SRC: Record<string, string> = {
    app: 'BREQ GPS',
    apple: 'APPLE WATCH',
    garmin: 'GARMIN',
    nike: 'NIKE RUN CLUB',
    strava: 'STRAVA',
  }
  const srcLabel = CERT_SRC[run.source ?? 'app'] ?? 'BREQ GPS'
  tlabel(`${srcLabel} · VERIFIED`, cx, H - m - 18 * u, {
    size: 18,
    align: 'center',
    color: pal.faint,
    ls: 4,
  })
}

/* ── 템플릿 비교 썸네일 ── */
function CardThumb({
  template,
  label,
  opts,
  selected,
  locked = false,
  onClick,
}: {
  template: CertTemplate
  label: string
  opts: Omit<DrawOpts, 'template'>
  selected: boolean
  locked?: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const r = RATIOS[opts.ratio]
  const cssW = 120
  const cssH = Math.round((cssW * r.h) / r.w)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => drawCard(c, { ...opts, template })
    draw()
    document.fonts.ready.then(() => {
      if (ref.current) drawCard(ref.current, { ...opts, template })
    })
  }, [template, opts])

  return (
    <button
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5"
      aria-label={`${label} 템플릿`}
    >
      <span
        className={`relative block overflow-hidden rounded-[6px] border-2 transition-colors ${
          selected ? 'border-brand' : 'border-line'
        }`}
      >
        <canvas
          ref={ref}
          width={Math.round(r.w * 0.32)}
          height={Math.round(r.h * 0.32)}
          style={{ width: cssW, height: cssH, display: 'block' }}
        />
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/45">
            <span className="rounded-[3px] bg-white px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.08em] text-ink">
              🔒 PRO
            </span>
          </span>
        )}
      </span>
      <span
        className={`text-[11px] font-extrabold ${selected ? 'text-ink' : 'text-mute'}`}
      >
        {label}
      </span>
    </button>
  )
}

const TEMPLATES: { id: CertTemplate; label: string; pro?: boolean }[] = [
  { id: 'minimal', label: '미니멀' },
  { id: 'route', label: '루트' },
  { id: 'photo', label: '포토' },
  { id: 'pride', label: '프라이드' },
  { id: 'crew', label: '크루' },
  { id: 'race', label: '레이스' },
  { id: 'monthly', label: '먼슬리 PRO', pro: true },
]

const THEMES: { id: CardTheme; label: string }[] = [
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
  { id: 'blue', label: '블루' },
  { id: 'photo', label: '포토' },
]

export default function Cert({
  profile,
  prefill,
  onStartRun,
}: {
  profile: Profile
  prefill?: RunRecord | null
  onStartRun: () => void
}) {
  const [step, setStep] = useState<'form' | 'card'>(prefill ? 'card' : 'form')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(prefill?.id ?? null)
  const [run, setRun] = useState<RunInput>(() => ({
    distanceKm: prefill ? prefill.distanceKm : 0,
    minutes: prefill ? Math.floor(prefill.durationSec / 60) : 0,
    seconds: prefill ? prefill.durationSec % 60 : 0,
    mood: '🙂',
    weather: '☀️',
    courseName: prefill?.course ?? '',
    shoe: '',
    withCrew: false,
    walkRun: false,
    source: prefill?.source,
    track: prefill?.track,
    splits: prefill?.splits,
    avgHr: prefill?.avgHr,
    cadence: prefill?.cadence,
  }))
  const [tpl, setTpl] = useState<CertTemplate>('minimal')
  const [pro, setPro] = useState(isPro())
  const [upsell, setUpsell] = useState(false)
  const [theme, setTheme] = useState<CardTheme>('light')
  const [ratio, setRatio] = useState<CardRatio>('story')
  const [copied, setCopied] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPhoto(img)
      setTheme('photo')
    }
    img.src = url
  }

  const chooseTemplate = (t: CertTemplate) => {
    setTpl(t)
    if (t === 'race') setTheme((cur) => (cur === 'light' ? 'dark' : cur))
    if (t === 'photo' && photo) setTheme('photo')
    if (t === 'crew')
      setRun((prev) =>
        prev.crewName
          ? prev
          : { ...prev, crewName: CREW.name, crewMembers: CREW.members.length + 1 },
      )
  }

  const chooseTheme = (t: CardTheme) => {
    if (t === 'photo' && !photo) {
      fileRef.current?.click()
      return
    }
    setTheme(t)
  }

  const paceSec = calcPace(run.distanceKm, run.minutes, run.seconds)
  const now = new Date()
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${days[now.getDay()]}`

  const tags = hashtags(profile.level, profile.region, run.withCrew)

  const monthly = useMemo<MonthlyAgg>(() => {
    const runs = allRecentRuns().filter((r) => r.distanceKm > 0 && r.durationSec > 0)
    const km = runs.reduce((s, r) => s + r.distanceKm, 0)
    const totalSec = runs.reduce((s, r) => s + r.durationSec, 0)
    const tracks = runs
      .map((r) => r.track)
      .filter((t): t is GeoPoint[] => !!t && t.length >= 2)
    const now = new Date()
    return {
      km,
      count: runs.length,
      paceSec: km > 0 ? totalSec / km : null,
      tracks,
      label: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`,
    }
  }, [])

  const drawOpts = useMemo<Omit<DrawOpts, 'template'>>(
    () => ({ theme, ratio, run, paceSec, dateStr, photo, monthly }),
    [theme, ratio, run, paceSec, dateStr, photo, monthly],
  )

  useEffect(() => {
    if (step !== 'card') return
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => drawCard(canvas, { ...drawOpts, template: tpl })
    draw()
    document.fonts.ready.then(draw)
  }, [step, tpl, drawOpts])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `breq-${Date.now()}.png`
    a.click()
    setShareMsg('이미지를 저장했어요. 인스타그램 스토리에 올려보세요!')
  }

  const share = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], 'breq.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          setShareMsg('공유 완료! 스토리에서 만나요 🏃')
        } catch {
          /* 사용자가 취소 */
        }
      } else {
        download()
        setShareMsg(
          '이 브라우저는 바로 공유를 지원하지 않아 이미지로 저장했어요. 인스타그램 앱에서 스토리에 추가해 주세요!',
        )
      }
    }, 'image/png')
  }

  const copyTags = async () => {
    await navigator.clipboard.writeText(tags.join(' '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ───────── 기록 선택 단계 ─────────
  if (step === 'form') {
    const recent = allRecentRuns()

    const selectRun = (r: RunRecord) => {
      setSelectedRunId(r.id)
      setRun((prev) => ({
        ...prev,
        distanceKm: r.distanceKm,
        minutes: Math.floor(r.durationSec / 60),
        seconds: r.durationSec % 60,
        courseName: r.course ?? prev.courseName,
        walkRun: false,
        source: r.source,
        track: r.track,
        splits: r.splits,
        avgHr: r.avgHr,
        cadence: r.cadence,
      }))
    }

    if (recent.length === 0) {
      return (
        <div className="px-4 pb-28 pt-5">
          <h1 className="text-[20px] font-extrabold text-ink">오늘의 러닝 인증</h1>
          <p className="mt-1 text-[13px] text-mute">
            인증 카드는 BREQ로 직접 측정한 러닝 기록으로만 만들 수 있어요.
          </p>
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-card px-5 py-10 text-center">
            <p className="text-[15px] font-bold text-ink">아직 측정된 러닝이 없어요</p>
            <p className="mt-2 text-[13px] leading-relaxed text-mute">
              거리·시간·페이스를 직접 입력하는 대신,
              <br />
              BREQ로 한 번 뛰면 그 기록으로 카드를 만들 수 있어요.
            </p>
            <button
              onClick={onStartRun}
              className="mt-5 w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white"
            >
              러닝 시작하기
            </button>
          </div>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-mute">
            애플워치·가민·스트라바를 연동하면 그 기록도 자동으로 불러와요.
            <br />
            <span className="font-semibold text-ink">마이 → 워치·앱 연동</span>에서 설정하세요.
          </p>
        </div>
      )
    }

    const selectedRun = recent.find((r) => r.id === selectedRunId) ?? null

    return (
      <div className="px-4 pb-28 pt-5">
        <h1 className="text-[20px] font-extrabold text-ink">오늘의 러닝 인증</h1>
        <p className="mt-1 text-[13px] text-mute">
          기록을 직접 입력할 수는 없어요. BREQ로 측정했거나 연동된 러닝 중 하나를 골라주세요.
        </p>

        <div className="mt-4">
          <span className="mb-1.5 block text-[13px] font-semibold text-mute">내 러닝 기록</span>
          <div className="space-y-2">
            {recent.map((r) => {
              const on = r.id === selectedRunId
              return (
                <button
                  key={r.id}
                  onClick={() => selectRun(r)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    on ? 'border-brand bg-brand/10' : 'border-line bg-card active:bg-card2'
                  }`}
                >
                  <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-[2px] bg-card2 text-[9px] font-extrabold tracking-[0.08em] text-mute">
                    {SOURCE_META[r.source].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink">
                      {r.distanceKm}km · {fmtClock(r.durationSec)}
                    </span>
                    <span className="block text-[11px] text-mute">
                      {r.dateLabel} {r.startTime} · {SOURCE_META[r.source].name}
                    </span>
                  </span>
                  <span className={`text-[14px] font-bold ${on ? 'text-brand' : 'text-mute'}`}>
                    {on ? '✓' : '선택'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {selectedRun && (
          <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-card py-3 text-center">
            {[
              { k: 'DISTANCE', v: `${run.distanceKm}km` },
              { k: 'TIME', v: fmtClock(run.minutes * 60 + run.seconds) },
              { k: 'PACE', v: run.walkRun ? '걷뛰' : paceSec ? `${fmtPace(paceSec)}/km` : '-' },
            ].map((c) => (
              <div key={c.k} className="px-1">
                <p className="text-[17px] font-extrabold tabular-nums text-ink">{c.v}</p>
                <p className="eyebrow mt-0.5">{c.k}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-card px-4 py-2">
          <Toggle
            on={run.walkRun}
            onChange={(v) => setRun({ ...run, walkRun: v })}
            label="걷뛰로 표시"
            desc="카드에 페이스 대신 '걷뛰'로 표시돼요"
          />
          <Toggle
            on={run.withCrew}
            onChange={(v) => setRun({ ...run, withCrew: v })}
            label="모임/크루와 함께 달렸어요"
            desc="크루 인증 템플릿을 추천해 드려요"
          />
        </div>

        <div className="mt-4">
          <Field label="코스 이름 (선택)">
            <input
              className={inputCls}
              placeholder="예: 반포한강공원"
              value={run.courseName}
              onChange={(e) => setRun({ ...run, courseName: e.target.value })}
            />
          </Field>
        </div>

        <button
          disabled={!selectedRunId}
          onClick={() => {
            if (run.withCrew) chooseTemplate('crew')
            setStep('card')
          }}
          className="mt-6 w-full rounded-2xl bg-brand py-4 text-[16px] font-bold text-white disabled:opacity-40"
        >
          {selectedRunId ? '인증 카드 만들기' : '기록을 먼저 선택하세요'}
        </button>
      </div>
    )
  }

  // ───────── 카드 디자인 단계 ─────────
  const ratioDims = RATIOS[ratio]

  return (
    <div className="px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-ink">인증 카드</h1>
        <button onClick={() => setStep('form')} className="text-[13px] font-semibold text-mute">
          ← 기록 변경
        </button>
      </div>

      {/* 템플릿 비교 */}
      <div className="mt-4">
        <SectionTitle>템플릿</SectionTitle>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {TEMPLATES.map((t) => {
            const locked = !!t.pro && !pro
            return (
              <CardThumb
                key={t.id}
                template={t.id}
                label={t.label}
                opts={drawOpts}
                selected={tpl === t.id}
                locked={locked}
                onClick={() => (locked ? setUpsell(true) : chooseTemplate(t.id))}
              />
            )
          })}
        </div>
        {upsell && (
          <div className="mt-3 rounded-[8px] border border-brand bg-brand/5 p-4">
            <p className="text-[13px] font-extrabold text-ink">PRO 전용 고급 카드</p>
            <p className="mt-1 text-[12px] leading-relaxed text-mute">
              월간 누적 마일리지 카드는 PRO 구독자만 만들 수 있어요. 이번 달 뛴 모든 루트가 한
              장에 모여요.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem('runnersway.pro', '1')
                  setPro(true)
                  setUpsell(false)
                  chooseTemplate('monthly')
                }}
                className="rounded-[6px] bg-brand px-4 py-2 text-[13px] font-bold text-white"
              >
                PRO 체험 켜기
              </button>
              <button
                onClick={() => setUpsell(false)}
                className="rounded-[6px] bg-card px-4 py-2 text-[13px] font-bold text-mute"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 배경 + 비율 */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle>배경</SectionTitle>
          <div className="flex gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => chooseTheme(t.id)}
                className={`rounded-[4px] border px-3 py-2 text-[12px] font-extrabold transition-colors ${
                  theme === t.id
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-card text-mute'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>비율</SectionTitle>
          <div className="flex gap-1.5">
            {(
              [
                ['story', '9:16'],
                ['feed', '4:5'],
              ] as [CardRatio, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRatio(key)}
                className={`rounded-[4px] border px-3 py-2 text-[12px] font-extrabold transition-colors ${
                  ratio === key
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-card text-mute'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-[4px] border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink"
            >
              {photo ? '사진 변경' : '+ 사진'}
            </button>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />

      {/* 템플릿별 라벨 입력 */}
      {tpl === 'crew' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field label="크루 / 모임 이름">
            <input
              className={inputCls}
              placeholder="예: BREQ RUN CREW"
              value={run.crewName ?? ''}
              onChange={(e) => setRun({ ...run, crewName: e.target.value })}
            />
          </Field>
          <Field label="인원">
            <input
              type="number"
              className={inputCls}
              min={1}
              placeholder="6"
              value={run.crewMembers ?? ''}
              onChange={(e) =>
                setRun({ ...run, crewMembers: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
        </div>
      )}
      {tpl === 'race' && (
        <div className="mt-4 rounded-2xl bg-card px-4 py-2">
          <Toggle
            on={!!run.isPB}
            onChange={(v) =>
              setRun({
                ...run,
                isPB: v,
                pbKind: v && !run.pbKind ? `${Math.round(run.distanceKm)}K PB` : run.pbKind,
              })
            }
            label="개인 기록 갱신 (PB/PR)"
            desc="카드에 PB 배지를 표시해요"
          />
          {run.isPB && (
            <div className="pb-2">
              <Field label="배지 문구">
                <input
                  className={inputCls}
                  placeholder="예: 10K PB"
                  value={run.pbKind ?? ''}
                  onChange={(e) => setRun({ ...run, pbKind: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* 미리보기 */}
      <div className="mt-5 flex justify-center">
        <canvas
          ref={canvasRef}
          width={ratioDims.w}
          height={ratioDims.h}
          className="rounded-2xl border border-line"
          style={{ width: ratio === 'story' ? '64%' : '78%', aspectRatio: `${ratioDims.w} / ${ratioDims.h}` }}
        />
      </div>

      {!photo && (
        <p className="mt-2 text-center text-[11px] text-mute">
          사진을 추가하면 ‘포토’ 배경으로 내 사진 위에 기록이 얹혀요.
        </p>
      )}

      <div className="mt-5">
        <SectionTitle
          right={
            <button onClick={copyTags} className="text-[12px] font-bold text-brand">
              {copied ? '복사됨 ✓' : '전체 복사'}
            </button>
          }
        >
          추천 해시태그
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-card px-3 py-1.5 text-[12px] font-semibold text-sky"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={download}
          className="rounded-2xl border border-line bg-card py-4 text-[15px] font-bold text-ink"
        >
          이미지 저장
        </button>
        <button
          onClick={share}
          className="rounded-2xl bg-ink py-4 text-[15px] font-extrabold text-white"
        >
          스토리 공유
        </button>
      </div>
      {shareMsg && (
        <p className="mt-3 rounded-xl bg-card px-3.5 py-3 text-center text-[12px] text-mute">
          {shareMsg}
        </p>
      )}
    </div>
  )
}
