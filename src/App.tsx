import { useCallback, useEffect, useRef, useState } from 'react'
import { ParlorScope } from './engine/scope.ts'
import { useChainPulse } from './hooks/useChainPulse.ts'
import { FAMILIES, familyColor, familyLabel, type Family } from './lib/programs.ts'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scopeRef = useRef<ParlorScope | null>(null)
  if (!scopeRef.current) scopeRef.current = new ParlorScope()

  const reduced = usePrefersReducedMotion()
  const [capped, setCapped] = useState(false)
  const cappedRef = useRef(false)
  const reducedRef = useRef(reduced)
  cappedRef.current = capped
  reducedRef.current = reduced

  const { hud, pull } = useChainPulse(capped)
  const pullRef = useRef(pull)
  pullRef.current = pull
  const hudRef = useRef(hud)
  hudRef.current = hud

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    const scope = scopeRef.current!
    let raf = 0
    let last = performance.now()

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const parent = canvas.parentElement ?? canvas
      const rect = parent.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      const w = Math.max(1, Math.floor(cssW * dpr))
      const h = Math.max(1, Math.floor(cssH * dpr))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas.parentElement ?? canvas)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const pulse = hudRef.current
      scope.frozen = cappedRef.current
      scope.capped = cappedRef.current
      scope.reduced = reducedRef.current
      scope.tps = pulse.tps
      scope.fee = pulse.fee
      scope.live = pulse.live
      scope.degraded = pulse.degraded
      if (pulse.slot != null) scope.setSlot(pulse.slot, now)
      scope.step(dt, now, () => pullRef.current())
      const parent = canvas.parentElement ?? canvas
      const rect = parent.getBoundingClientRect()
      scope.draw(ctx, rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2), now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const toggleCap = useCallback(() => {
    setCapped((c) => !c)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return
      }
      e.preventDefault()
      toggleCap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCap])

  const slot = hud.slot != null ? hud.slot.toLocaleString('en-US') : '—'
  const tps = hud.tps != null ? Math.round(hud.tps).toLocaleString('en-US') : '—'
  const rtt = hud.rttMs != null ? `${Math.round(hud.rttMs)}` : '—'
  const live = hud.live && !capped

  return (
    <div className={`parlor${capped ? ' capped' : ''}`}>
      <div className="stage">
        <canvas ref={canvasRef} className="eye" aria-label="Parlor kaleidoscope eyepiece" />
      </div>

      <header className="mast">
        <p className="kicker">coal-oil · smoked glass · confirmed slot · mainnet</p>
        <h1>Slotkaleidoscope</h1>
        <p className="lede">the chain, as a parlor eyepiece</p>
      </header>

      <aside className="plate">
        <p className="plate-mark">
          RK · TUBE 01 · {hud.degraded ? 'degraded' : hud.host}
        </p>

        <button
          type="button"
          className={`capkey${capped ? ' on' : ''}`}
          onClick={toggleCap}
          aria-pressed={capped}
        >
          <span className="lid" aria-hidden="true">
            <i />
          </span>
          <span className="capkey-copy">
            <em>{capped ? 'capped' : 'open'}</em>
            {capped ? 'UNCAP' : 'CAP EYE'}
          </span>
        </button>

        <dl className="strip">
          <Readout k="slot" v={slot} live={live} />
          <Readout k="approx tps" v={tps} live={live} />
          <Readout k="rpc rtt" v={rtt} unit="ms" live={live} />
        </dl>

        <div className="glare" aria-hidden="true">
          <span>idle</span>
          <i>
            <b style={{ width: `${Math.round(hud.fee * 100)}%` }} />
          </i>
          <span>busy</span>
        </div>

        <ul className="legend">
          {FAMILIES.map((f) => (
            <li key={f}>
              <i style={{ background: familyColor(f as Family) }} />
              {familyLabel(f as Family)}
            </li>
          ))}
          <li>
            <i className="fail" />
            crack / gap
          </li>
        </ul>

        <p className="hint">
          Space caps the eyepiece and holds the sample. Uncap to resume the live tumble.
        </p>
      </aside>
    </div>
  )
}

function Readout({
  k,
  v,
  unit,
  live,
}: {
  k: string
  v: string
  unit?: string
  live: boolean
}) {
  return (
    <div className={`read${live ? ' live' : ''}`}>
      <dt>{k}</dt>
      <dd>
        {v}
        {unit ? <em>{unit}</em> : null}
      </dd>
    </div>
  )
}
