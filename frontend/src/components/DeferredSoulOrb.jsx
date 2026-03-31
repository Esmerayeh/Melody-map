import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const MusicSoulOrb = lazy(() => import('./MusicSoulOrb'))

function SoulOrbFallback({ size = 180 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(182,141,255,0.2),transparent_62%)] blur-2xl" />
      <div className="absolute inset-[18%] rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(28,24,48,0.9),rgba(10,8,22,0.65))] shadow-[0_0_40px_rgba(143,117,255,0.1)]" />
    </div>
  )
}

export default function DeferredSoulOrb(props) {
  const { size = 180 } = props
  const containerRef = useRef(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      setShouldRender(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin: '220px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef}>
      <Suspense fallback={<SoulOrbFallback size={size} />}>
        {shouldRender ? <MusicSoulOrb {...props} /> : <SoulOrbFallback size={size} />}
      </Suspense>
    </div>
  )
}
