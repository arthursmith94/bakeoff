import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  rot: number
  size: number
  kind: 'crumb' | 'chip'
}
interface Float {
  id: number
  x: number
  y: number
  text: string
}

interface Props {
  multiplier: number
  disabled?: boolean
  onBake: () => boolean
  /** Fires a burst of particles from the center (used for celebrations). */
  burstSignal?: number
}

const CHIPS = [
  [28, 26, 11, 9],
  [62, 20, 9, 8],
  [72, 52, 12, 9],
  [45, 60, 9, 8],
  [22, 62, 8, 7],
  [50, 38, 8, 7],
  [80, 32, 7, 6],
  [38, 80, 9, 7],
  [64, 78, 8, 7],
]

export function CookieButton({ multiplier, disabled, onBake, burstSignal }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [floats, setFloats] = useState<Float[]>([])
  const [bite, setBite] = useState(0)
  const idRef = useRef(0)
  const btnRef = useRef<HTMLButtonElement>(null)

  const spawn = useCallback((x: number, y: number, count: number, spread = 1, text?: string) => {
    const ps: Particle[] = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = (40 + Math.random() * 70) * spread
      ps.push({
        id: ++idRef.current,
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 30 * spread,
        rot: (Math.random() - 0.5) * 540,
        size: 4 + Math.random() * 6,
        kind: Math.random() < 0.3 ? 'chip' : 'crumb',
      })
    }
    setParticles((p) => [...p, ...ps].slice(-120))
    const ids = ps.map((p) => p.id)
    setTimeout(() => setParticles((p) => p.filter((q) => !ids.includes(q.id))), 800)
    if (text) {
      const f = { id: ++idRef.current, x: x + (Math.random() - 0.5) * 40, y: y - 20, text }
      setFloats((fs) => [...fs, f].slice(-12))
      setTimeout(() => setFloats((fs) => fs.filter((q) => q.id !== f.id)), 900)
    }
  }, [])

  const bake = useCallback(
    (cx?: number, cy?: number) => {
      if (disabled) return
      const el = btnRef.current
      const rect = el?.getBoundingClientRect()
      const x = cx !== undefined && rect ? cx - rect.left : (rect?.width ?? 0) / 2
      const y = cy !== undefined && rect ? cy - rect.top : (rect?.height ?? 0) / 2
      const ok = onBake()
      if (!ok) return
      setBite((b) => b + 1)
      spawn(x, y, 7, 1, `+${multiplier}`)
    },
    [disabled, onBake, spawn, multiplier],
  )

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Keyboard "clicks" arrive with detail === 0 and no coordinates.
    if (e.detail === 0) bake()
    else bake(e.clientX, e.clientY)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Let Enter auto-repeat when held (native buttons only fire click on keyup for Space).
    if (e.key === 'Enter' && e.repeat) {
      e.preventDefault()
      bake()
    }
  }

  useEffect(() => {
    if (!burstSignal) return
    const rect = btnRef.current?.getBoundingClientRect()
    spawn((rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2, 40, 2.2, 'LEVEL UP!')
  }, [burstSignal, spawn])

  useEffect(() => {
    btnRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="cookie-stage">
      <button
        ref={btnRef}
        type="button"
        className={`cookie ${bite % 2 ? 'bite-a' : 'bite-b'} ${disabled ? 'is-disabled' : ''}`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-label={`Bake a cookie (+${multiplier} per click). Press Space or Enter.`}
        aria-disabled={disabled}
        data-bite={bite}
      >
        <span className="cookie-face" aria-hidden="true">
          {CHIPS.map(([x, y, w, h], i) => (
            <span key={i} className="chip" style={{ left: `${x}%`, top: `${y}%`, width: w, height: h }} />
          ))}
        </span>
      </button>
      <div className="particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className={`particle particle-${p.kind}`}
            style={
              {
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size * (p.kind === 'chip' ? 0.8 : 1),
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--rot': `${p.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
        {floats.map((f) => (
          <span key={f.id} className={`float ${f.text.length > 4 ? 'float-big' : ''}`} style={{ left: f.x, top: f.y }}>
            {f.text}
          </span>
        ))}
      </div>
    </div>
  )
}
