import { familyColor, type Family } from '../lib/programs.ts'
import { PALETTE } from '../lib/palette.ts'

export type ShardSpec = {
  family: Family
  sig: string
  failed: boolean
}

type Wound = 'glass' | 'crack' | 'soot' | 'gap'

type Shard = {
  id: string
  family: Family
  failed: boolean
  wound: Wound
  sides: number
  jagged: number[]
  r: number
  a: number
  r0: number
  a0: number
  r1: number
  a1: number
  size: number
  rot: number
  rot1: number
  tumble: number
  born: number
}

const FOLDS = 6
const WEDGE = Math.PI / 3
const TUMBLE_S = 0.52

function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

function woundOf(sig: string): Wound {
  const n = hash32(sig) % 5
  if (n === 0) return 'gap'
  if (n === 1) return 'soot'
  return 'crack'
}

export class ParlorScope {
  frozen = false
  reduced = false
  tps: number | null = null
  fee = 0.1
  slot: number | null = null
  live = false
  degraded = false
  capped = false

  private shards: Shard[] = []
  private angle = 0
  private targetAngle = 0
  private tumbleUntil = 0
  private lastSlot = -1

  setSlot(slot: number, now: number) {
    if (slot === this.lastSlot) return
    const first = this.lastSlot < 0
    this.lastSlot = slot
    this.slot = slot
    this.targetAngle = ((slot % 12) * Math.PI) / 6
    if (first) {
      this.angle = this.targetAngle
      for (const s of this.shards) this.restow(s, slot, true)
      return
    }
    this.tumbleUntil = now + TUMBLE_S * 1000
    for (const s of this.shards) this.restow(s, slot, this.reduced || this.frozen)
  }

  private restow(s: Shard, slot: number, instant: boolean) {
    const rng = mulberry32(hash32(`${s.id}:${slot}`))
    s.r0 = s.r
    s.a0 = s.a
    s.r1 = 0.16 + rng() * 0.74
    s.a1 = (rng() - 0.5) * WEDGE * 0.88
    s.rot1 = rng() * Math.PI * 2
    if (instant) {
      s.r = s.r1
      s.a = s.a1
      s.rot = s.rot1
      s.tumble = 1
    } else {
      s.tumble = 0
    }
  }

  private add(spec: ShardSpec, now: number) {
    const rng = mulberry32(hash32(spec.sig))
    const sides = 4 + Math.floor(rng() * 3)
    const jagged = Array.from({ length: sides }, () => 0.55 + rng() * 0.55)
    const slot = this.slot ?? 0
    const shard: Shard = {
      id: spec.sig,
      family: spec.family,
      failed: spec.failed,
      wound: spec.failed ? woundOf(spec.sig) : 'glass',
      sides,
      jagged,
      r: 0.2 + rng() * 0.7,
      a: (rng() - 0.5) * WEDGE * 0.88,
      r0: 0,
      a0: 0,
      r1: 0,
      a1: 0,
      size: 20 + rng() * 26,
      rot: rng() * Math.PI * 2,
      rot1: rng() * Math.PI * 2,
      tumble: 1,
      born: now,
    }
    shard.r0 = shard.r
    shard.a0 = shard.a
    this.restow(shard, slot, true)
    this.shards.push(shard)
  }

  step(dt: number, now: number, pull: () => ShardSpec | null) {
    const density = 12 + Math.floor(this.fee * 18)
    if (!this.frozen) {
      let n = 0
      while (this.shards.length < density && n < 4) {
        const spec = pull()
        if (!spec) break
        this.add(spec, now)
        n += 1
      }
    }

    this.shards = this.shards.filter((s) => {
      const life = s.failed ? 15000 : 8200
      return now - s.born < life
    })
    if (this.shards.length > density + 6) {
      const extras = this.shards
        .filter((s) => !s.failed)
        .sort((a, b) => a.born - b.born)
      const drop = this.shards.length - (density + 4)
      const kill = new Set(extras.slice(0, Math.max(0, drop)).map((s) => s.id))
      this.shards = this.shards.filter((s) => !kill.has(s.id) || s.failed)
    }

    const tumbling = now < this.tumbleUntil && !this.frozen && !this.reduced
    const speed = tumbling ? dt / TUMBLE_S : dt / 0.18
    for (const s of this.shards) {
      if (this.reduced || this.frozen) {
        s.r = s.r1
        s.a = s.a1
        s.rot = s.rot1
        s.tumble = 1
        continue
      }
      s.tumble = Math.min(1, s.tumble + speed)
      const e = easeOutCubic(s.tumble)
      s.r = lerp(s.r0, s.r1, e)
      s.a = lerp(s.a0, s.a1, e)
      s.rot = lerpAngle(s.rot, s.rot1, e)
    }

    if (this.reduced || this.frozen) {
      this.angle = this.targetAngle
    } else {
      const k = 1 - Math.exp(-dt * (tumbling ? 7 : 4))
      this.angle = lerpAngle(this.angle, this.targetAngle, k)
    }
  }

  draw(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, _dpr: number, now: number) {
    const w = cssW
    const h = cssH
    ctx.clearRect(0, 0, w, h)
    this.paintParlor(ctx, w, h)

    const cx = w * 0.5
    const cy = h * 0.5 + Math.min(h, w) * 0.018
    const R = Math.min(w, h) * 0.42
    const inner = R * 0.86

    this.paintLampBloom(ctx, cx, cy, R)
    this.paintBarrel(ctx, cx, cy, R)
    this.paintEye(ctx, cx, cy, inner, now)
    if (this.capped) this.paintCapHint(ctx, cx, cy, inner)
    this.paintBezel(ctx, cx, cy, R, inner)
  }

  private paintParlor(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createRadialGradient(w * 0.42, h * 0.28, 20, w * 0.5, h * 0.55, Math.max(w, h) * 0.72)
    g.addColorStop(0, '#2a1810')
    g.addColorStop(0.42, PALETTE.coal)
    g.addColorStop(1, '#080604')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    const felt = ctx.createRadialGradient(w * 0.5, h * 0.92, 10, w * 0.5, h * 1.05, w * 0.72)
    felt.addColorStop(0, rgba(PALETTE.felt, 0.55))
    felt.addColorStop(0.55, rgba(PALETTE.felt, 0.22))
    felt.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = felt
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.98, w * 0.62, h * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.globalAlpha = 0.045
    ctx.strokeStyle = PALETTE.smoke
    ctx.lineWidth = 1
    for (let y = 0; y < h; y += 3) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private paintLampBloom(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
    const heat = this.capped ? this.fee * 0.35 : 0.38 + this.fee * 0.72
    const glow = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R * 1.95)
    glow.addColorStop(0, rgba(PALETTE.lampoil, 0.02))
    glow.addColorStop(0.42, rgba(PALETTE.lampoil, 0.14 * heat))
    glow.addColorStop(0.7, rgba(PALETTE.brass, 0.2 * heat))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.85, 0, Math.PI * 2)
    ctx.fill()
  }

  private paintBarrel(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
    const outer = R * 1.1
    const metal = ctx.createLinearGradient(cx - outer, cy - outer, cx + outer, cy + outer)
    metal.addColorStop(0, '#8a6428')
    metal.addColorStop(0.28, PALETTE.brass)
    metal.addColorStop(0.55, '#7a5420')
    metal.addColorStop(0.82, '#e8c878')
    metal.addColorStop(1, '#4a3010')
    ctx.beginPath()
    ctx.arc(cx, cy, outer, 0, Math.PI * 2)
    ctx.fillStyle = metal
    ctx.fill()

    ctx.save()
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 === 0 ? rgba(PALETTE.coal, 0.42) : rgba(PALETTE.lampoil, 0.22)
      ctx.lineWidth = i % 2 === 0 ? 1.6 : 1
      ctx.beginPath()
      ctx.arc(cx, cy, R * (1.015 + i * 0.014), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()

    const rivets = 12
    for (let i = 0; i < rivets; i++) {
      const t = (i / rivets) * Math.PI * 2 + 0.12
      const rr = R * 1.045
      const x = cx + Math.cos(t) * rr
      const y = cy + Math.sin(t) * rr
      const rg = ctx.createRadialGradient(x - 1.4, y - 1.4, 0.4, x, y, 5)
      rg.addColorStop(0, '#f4dc9a')
      rg.addColorStop(0.55, PALETTE.brass)
      rg.addColorStop(1, '#3a2410')
      ctx.beginPath()
      ctx.arc(x, y, 4.2, 0, Math.PI * 2)
      ctx.fillStyle = rg
      ctx.fill()
    }
  }

  private paintEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, now: number) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.clip()

    const tube = ctx.createRadialGradient(cx, cy, inner * 0.05, cx, cy, inner)
    tube.addColorStop(0, '#2a1a10')
    tube.addColorStop(0.55, '#120C08')
    tube.addColorStop(1, '#080604')
    ctx.fillStyle = tube
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)

    const tumbling = now < this.tumbleUntil && !this.frozen && !this.reduced
    const blur = this.reduced || this.frozen ? 0 : this.fee * (tumbling ? 1 : 0.45)
    const ghosts = blur > 0.35 ? 2 : blur > 0.18 ? 1 : 0

    for (let g = ghosts; g >= 0; g--) {
      const ghostA = g === 0 ? 1 : 0.22
      const ghostRot = g === 0 ? 0 : (g % 2 === 0 ? -1 : 1) * blur * 0.045
      ctx.save()
      ctx.globalAlpha = ghostA
      this.paintFolds(ctx, cx, cy, inner, this.angle + ghostRot)
      ctx.restore()
    }

    if (this.fee > 0.2 && !this.capped) {
      const glare = ctx.createRadialGradient(
        cx - inner * 0.22,
        cy - inner * 0.28,
        2,
        cx,
        cy,
        inner * 0.95,
      )
      glare.addColorStop(0, rgba(PALETTE.lampoil, 0.1 + this.fee * 0.16))
      glare.addColorStop(0.35, rgba(PALETTE.lampoil, 0.04))
      glare.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glare
      ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)
    }

    const vig = ctx.createRadialGradient(cx, cy, inner * 0.55, cx, cy, inner)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(8,6,4,0.55)')
    ctx.fillStyle = vig
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)

    ctx.restore()
  }

  private paintFolds(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, angle: number) {
    for (let i = 0; i < FOLDS; i++) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle + i * WEDGE)
      if (i % 2 === 1) ctx.scale(1, -1)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, inner, -WEDGE / 2, WEDGE / 2)
      ctx.closePath()
      ctx.clip()
      const glass = ctx.createLinearGradient(0, 0, inner * 0.55, inner * 0.2)
      glass.addColorStop(0, rgba(PALETTE.lampoil, 0.07))
      glass.addColorStop(0.55, rgba(PALETTE.felt, 0.05))
      glass.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glass
      ctx.fill()
      this.paintShards(ctx, inner)
      ctx.strokeStyle = rgba(PALETTE.smoke, 0.28)
      ctx.lineWidth = 1.15
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(-WEDGE / 2) * inner, Math.sin(-WEDGE / 2) * inner)
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(WEDGE / 2) * inner, Math.sin(WEDGE / 2) * inner)
      ctx.stroke()
      ctx.restore()
    }
  }

  private paintShards(ctx: CanvasRenderingContext2D, inner: number) {
    for (const s of this.shards) {
      const x = Math.cos(s.a) * s.r * inner * 0.9
      const y = Math.sin(s.a) * s.r * inner * 0.9
      const size = s.size * (inner / 150)
      if (s.failed && s.wound === 'gap') {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(s.rot)
        ctx.beginPath()
        ctx.moveTo(-size * 0.4, -size * 0.55)
        ctx.lineTo(size * 0.5, -size * 0.1)
        ctx.lineTo(-size * 0.15, size * 0.6)
        ctx.closePath()
        ctx.fillStyle = 'rgba(6,4,3,0.94)'
        ctx.fill()
        ctx.strokeStyle = rgba(PALETTE.claret, 0.5)
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
        continue
      }

      const tint = s.failed && s.wound === 'soot' ? '#1a100c' : familyColor(s.family)
      const alpha = s.failed ? 0.8 : 0.88
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(s.rot)
      ctx.beginPath()
      for (let i = 0; i < s.sides; i++) {
        const t = (i / s.sides) * Math.PI * 2
        const j = s.jagged[i] ?? 1
        const px = Math.cos(t) * size * j
        const py = Math.sin(t) * size * j
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      const lg = ctx.createLinearGradient(-size, -size, size * 0.8, size)
      lg.addColorStop(0, rgba(PALETTE.lampoil, 0.28))
      lg.addColorStop(0.28, rgba(tint, alpha))
      lg.addColorStop(1, rgba(tint, 0.55))
      ctx.fillStyle = lg
      ctx.fill()
      ctx.strokeStyle = rgba(tint, s.failed ? 0.35 : 0.7)
      ctx.lineWidth = 1.05
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(-size * 0.2, -size * 0.35)
      ctx.lineTo(size * 0.15, -size * 0.15)
      ctx.lineTo(-size * 0.05, size * 0.05)
      ctx.closePath()
      ctx.fillStyle = rgba(PALETTE.lampoil, 0.22)
      ctx.fill()

      if (s.failed && s.wound === 'crack') {
        ctx.strokeStyle = rgba(PALETTE.coal, 0.8)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-size * 0.3, -size * 0.2)
        ctx.lineTo(size * 0.1, size * 0.05)
        ctx.lineTo(-size * 0.05, size * 0.4)
        ctx.moveTo(size * 0.05, -size * 0.3)
        ctx.lineTo(size * 0.25, size * 0.15)
        ctx.stroke()
        ctx.strokeStyle = rgba(PALETTE.claret, 0.45)
        ctx.beginPath()
        ctx.moveTo(-size * 0.3, -size * 0.2)
        ctx.lineTo(size * 0.1, size * 0.05)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  private paintCapHint(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = rgba(PALETTE.coal, 0.22)
    ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)
    ctx.fillStyle = rgba(PALETTE.felt, 0.18)
    ctx.beginPath()
    ctx.ellipse(cx, cy - inner * 0.72, inner * 0.92, inner * 0.38, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private paintBezel(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, inner: number) {
    const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
    ring.addColorStop(0, '#f0d890')
    ring.addColorStop(0.25, PALETTE.brass)
    ring.addColorStop(0.55, '#6a4a1c')
    ring.addColorStop(0.8, '#e0c070')
    ring.addColorStop(1, '#3a2810')
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true)
    ctx.fillStyle = ring
    ctx.fill()

    ctx.save()
    ctx.strokeStyle = rgba(PALETTE.coal, 0.4)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, inner + 1.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = rgba(PALETTE.lampoil, this.capped ? 0.15 : 0.35 + this.fee * 0.3)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, inner + 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    const ticks = 24
    ctx.save()
    ctx.strokeStyle = rgba(PALETTE.coal, 0.45)
    ctx.lineWidth = 1.4
    for (let i = 0; i < ticks; i++) {
      const t = (i / ticks) * Math.PI * 2
      const long = i % 6 === 0
      const a0 = inner + (long ? 6 : 10)
      const a1 = R - (long ? 6 : 10)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(t) * a0, cy + Math.sin(t) * a0)
      ctx.lineTo(cx + Math.cos(t) * a1, cy + Math.sin(t) * a1)
      ctx.stroke()
    }
    ctx.restore()

    if (this.slot != null) {
      const mark = ((this.slot % 24) / 24) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(mark) * ((inner + R) / 2), cy + Math.sin(mark) * ((inner + R) / 2), 3.2, 0, Math.PI * 2)
      ctx.fillStyle = this.live && !this.capped ? PALETTE.lampoil : rgba(PALETTE.smoke, 0.55)
      ctx.fill()
    }
  }
}
