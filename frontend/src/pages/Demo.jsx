/**
 * Demo.jsx
 * --------
 * Public route — no auth required.
 *
 * Shows a fully interactive galaxy, Soul Orb, and identity panel built from
 * the DEMO_PROFILE seed data.  Every surface is clearly labeled "Demo universe"
 * so visitors understand this is a preview, not their personal data.
 *
 * Route: /demo  (added to App.jsx, no ProtectedRoute wrapper)
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link }         from 'react-router-dom'
import { motion }       from 'framer-motion'
import { Sparkles, Disc3, ArrowRight, Lock } from 'lucide-react'
import { DEMO_PROFILE } from '../data/demoPlanet'
import { buildGalaxyModel }    from '../features/galaxy/galaxyBuilder'
import { useGalaxyStageConfig } from '../features/galaxy/useGalaxyStage'
import DeferredSoulOrb         from '../components/DeferredSoulOrb'
import AtmosphereBackground    from '../components/premium/AtmosphereBackground'
import ShimmerDivider          from '../components/premium/ShimmerDivider'
import NebulaLoader            from '../components/premium/NebulaLoader'
import GenesisSequence, { GenesisGalaxyGate } from '../features/universe/GenesisSequence'
import { CometLayer, CometDecodeOverlay, useDiscoveryComets } from '../features/universe/DiscoveryComets'
import { GhostConstellationLines, MemoryBeltPanel, useMemoryBelt } from '../features/universe/MemoryBelt'
import { ObsessionGravityWell, useObsessionNode } from '../features/universe/ObsessionWell'
import { IdentityPassportModal } from '../features/universe/IdentityPassport'
import useAdaptiveExperience   from '../hooks/useAdaptiveExperience'
import useGalaxyInteractionStore from '../features/galaxy/useGalaxyInteractionStore'
import GalaxyControls          from '../features/galaxy/GalaxyControls'
import GalaxyLegend            from '../features/galaxy/GalaxyLegend'
import GalaxyInspector         from '../features/galaxy/GalaxyInspector'
import { MOTION_TOKENS }       from '../features/motion/motionTokens'
import { resolveInteractionEntity } from '../features/galaxy/interactionModel'

// ── Demo banner ────────────────────────────────────────────────────────────
function DemoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_TOKENS.panel}
      className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200 backdrop-blur"
    >
      Demo universe · not your real data
    </motion.div>
  )
}

// ── Connect CTA ────────────────────────────────────────────────────────────
function ConnectCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TOKENS.focusSettle, delay: 0.6 }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0c1e]/80 p-6 backdrop-blur"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(224,163,92,0.14),transparent_50%)]" />
      <p className="relative z-10 text-xs uppercase tracking-[0.2em] text-gray-500">Ready for your own universe?</p>
      <h3 className="relative z-10 mt-2 text-xl font-black text-white">Connect your Spotify.</h3>
      <p className="relative z-10 mt-2 text-sm leading-relaxed text-gray-400">
        Your actual listening data will become a living galaxy shaped by your taste — not this seed pattern.
      </p>
      <div className="relative z-10 mt-5 flex flex-wrap gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#e0a35c] to-[#f0c089] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(224,163,92,0.3)] transition-all hover:opacity-90"
        >
          <Lock className="h-3.5 w-3.5" />
          Connect Spotify
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-sm text-gray-300 transition-all hover:border-white/22 hover:text-white"
        >
          Learn more
        </Link>
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Demo() {
  const adaptive = useAdaptiveExperience()

  // All galaxy interaction hooks — declared unconditionally (Rules of Hooks)
  const galaxyMode      = useGalaxyInteractionStore((s) => s.galaxyMode)
  const viewMode        = useGalaxyInteractionStore((s) => s.viewMode)
  const constellationMode = useGalaxyInteractionStore((s) => s.constellationMode)
  const showTracks      = useGalaxyInteractionStore((s) => s.showTracks)
  const showMoodRegions = useGalaxyInteractionStore((s) => s.showMoodRegions)
  const searchQuery     = useGalaxyInteractionStore((s) => s.searchQuery)
  const hoveredObject   = useGalaxyInteractionStore((s) => s.hoveredObject)
  const focusedObject   = useGalaxyInteractionStore((s) => s.focusedObject)
  const setGalaxyMode   = useGalaxyInteractionStore((s) => s.setGalaxyMode)
  const setViewMode     = useGalaxyInteractionStore((s) => s.setViewMode)
  const toggleTracks    = useGalaxyInteractionStore((s) => s.toggleTracks)
  const toggleMoodRegions = useGalaxyInteractionStore((s) => s.toggleMoodRegions)
  const setSearchQuery  = useGalaxyInteractionStore((s) => s.setSearchQuery)
  const resetGalaxy     = useGalaxyInteractionStore((s) => s.resetGalaxyInteraction)

  const [model,          setModel]         = useState(null)
  const [showPassport,   setShowPassport]  = useState(false)
  const {
    comets: demoComets,
    decoded: decodedComet,
    captured: capturedComets,
    handleCometClick,
    handleCapture,
    handleClose: handleCometClose,
  } = useDiscoveryComets({ profile: DEMO_PROFILE, isDemo: true })

  const ghostNodes    = useMemoryBelt(model)
  const obsessionNode = useObsessionNode(model)

  // Build galaxy model from demo profile
  useEffect(() => {
    const built = buildGalaxyModel(DEMO_PROFILE)
    setModel(built)
    return () => resetGalaxy()
  }, [resetGalaxy])

  const activeViewMode = constellationMode ? 'constellation' : viewMode

  const focusedEntity = useMemo(
    () => resolveInteractionEntity(model, DEMO_PROFILE, focusedObject),
    [model, focusedObject],
  )

  // Comets + memory/obsession extras rendered inside the persistent galaxy
  // <Canvas> via the stage store.
  const stageExtraChildren = useMemo(() => (
    <>
      <Suspense fallback={null}>
        <CometLayer comets={demoComets} onCometClick={handleCometClick} reducedMotion={adaptive.reducedMotion} />
      </Suspense>
      <GhostConstellationLines ghostNodes={ghostNodes} reducedMotion={adaptive.reducedMotion} />
      {obsessionNode && <ObsessionGravityWell node={obsessionNode} reducedMotion={adaptive.reducedMotion} />}
    </>
  ), [demoComets, handleCometClick, ghostNodes, obsessionNode, adaptive.reducedMotion])

  // Publish the demo galaxy to the ONE persistent canvas (App shell). This public
  // route no longer mounts its own <Canvas>.
  useGalaxyStageConfig({
    model,
    sparseMode:    false,
    lowPower:      adaptive.sparseGraphics,
    reducedMotion: adaptive.reducedMotion,
    webglEnabled:  adaptive.webglSupported,
    extraChildren: stageExtraChildren,
  }, [model, adaptive.sparseGraphics, adaptive.reducedMotion, adaptive.webglSupported, stageExtraChildren])

  const controlProps = {
    isDemo:            true,
    loading:           !model,
    cinemaMode:        false,
    onRefresh:         () => setModel(buildGalaxyModel(DEMO_PROFILE)),
    galaxyMode,
    onChangeGalaxyMode:setGalaxyMode,
    viewMode:          activeViewMode,
    onChangeViewMode:  setViewMode,
    showTracks,
    onToggleTracks:    toggleTracks,
    showMoodRegions,
    onToggleMoodRegions: toggleMoodRegions,
    searchQuery,
    onSearchChange:    setSearchQuery,
  }

  return (
    // Lifted above the persistent galaxy (fixed, z-0) with a transparent
    // background so the live galaxy shows through edge-to-edge.
    <div className="relative z-10 min-h-[100dvh]">
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#e0a35c] to-[#c97b7b]">
            <Disc3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Melody Map</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            Demo
          </span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#e0a35c] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_18px_rgba(224,163,92,0.3)] transition-all hover:opacity-90"
          >
            <Lock className="h-3 w-3" />
            Connect Spotify
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 pb-6">
        <div className="relative mb-6 overflow-hidden rounded-[36px] border border-white/8 bg-[#070714] p-6 lg:p-8">
          <AtmosphereBackground variant="galaxy" intensity="rich" anchored />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="premium-kicker mb-3 text-amber-300">Demo universe</p>
              <h1 className="premium-hero-title">
                Your music becomes a living galaxy.
                <span className="text-gradient-aurora mt-2 block">This is what it looks like.</span>
              </h1>
              <p className="premium-body mt-4 max-w-xl">
                Every artist is a star. Every genre is a nebula. Obsessions bend gravity.
                Discovery sends comets from the outer rim. This demo uses seed data —
                connect Spotify to see your own universe.
              </p>
              <ShimmerDivider className="my-5 max-w-lg" />
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#e0a35c] to-[#f0c089] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(224,163,92,0.28)] transition hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  Connect Spotify — it is free
                </Link>
              </div>
            </div>

            {/* Soul Orb hero */}
            <div className="flex flex-col items-center gap-3">
              <DeferredSoulOrb
                personality={DEMO_PROFILE.personality}
                personalityMeta={DEMO_PROFILE.personalityMeta}
                mbti={DEMO_PROFILE.mbti}
                mbtiMeta={DEMO_PROFILE.mbtiMeta}
                audioFeatures={DEMO_PROFILE.audioFeatures}
                analyticsMetrics={DEMO_PROFILE.analyticsMetrics}
                genres={DEMO_PROFILE.genres}
                topArtists={DEMO_PROFILE.topArtists}
                size={320}
                showLabels
                lowPower={adaptive.sparseGraphics}
              />
              <p className="text-center text-[10px] uppercase tracking-[0.22em] text-gray-600">
                demo soul orb · dreamy / melancholic
              </p>
            </div>
          </div>
        </div>

        {/* ── Galaxy canvas ─────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-600">Demo galaxy · seed data</p>
          {model && <GalaxyControls {...controlProps} />}
        </div>

        {/* Transparent window onto the persistent galaxy behind this route. */}
        <div className="relative h-[60dvh] min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 sm:h-[640px]">
          <DemoBanner />
          <GenesisSequence isDemo auralithLine="Your listening history is a universe. This is what it looks like." />

          {!model ? (
            <div className="flex h-full items-center justify-center">
              <NebulaLoader label="Assembling the demo galaxy" detail="Planting stars, nebulae, and memory fossils." />
            </div>
          ) : (
            <motion.div
              className="h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <GalaxyLegend
                clusters={model?.clusters || []}
                regions={model?.regions   || []}
                density={model?.metadata?.density}
                profileTier={model?.metadata?.profileTier}
                onSelectCluster={() => {}}
                onSelectRegion={() => {}}
              />
            </motion.div>
          )}
        </div>

        {/* Discovery comet decode card */}
        <CometDecodeOverlay
          decoded={decodedComet}
          isDemo
          onClose={handleCometClose}
          onCapture={handleCapture}
          captured={capturedComets}
        />

        {/* ── Identity + CTA ────────────────────────────────────────────── */}
        {model && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...MOTION_TOKENS.panel, delay: 0.4 }}
            className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"
          >
            <GalaxyInspector
              node={focusedEntity.node}
              edge={focusedEntity.edge}
              cluster={focusedEntity.cluster}
              region={focusedEntity.region}
            />
            <ConnectCTA />
          </motion.div>
        )}

        {/* ── Feature teaser row ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...MOTION_TOKENS.panel, delay: 0.8 }}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { label: 'Music Galaxy',      desc: 'Living 3D taste map',         color: '#e0a35c' },
            { label: 'Soul Orb',          desc: 'Your emotional identity',      color: '#f28ddf' },
            { label: 'Discover Engine',   desc: 'Comets from the outer rim',    color: '#9fdcff' },
            { label: 'Auralith Oracle',   desc: 'Ask what your music means',    color: '#f1c68a' },
          ].map(({ label, desc, color }) => (
            <Link
              key={label}
              to="/login"
              className="group relative overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-white/16 hover:bg-white/[0.04]"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 30% 50%, ${color}14 0%, transparent 60%)` }}
              />
              <p className="relative z-10 text-sm font-semibold text-white">{label}</p>
              <p className="relative z-10 mt-1 text-xs text-gray-500">{desc}</p>
              <div
                className="relative z-10 mt-3 h-0.5 w-8 rounded-full opacity-40"
                style={{ background: color }}
              />
            </Link>
          ))}
        </motion.div>

        {/* Universe Passport CTA */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowPassport(true)}
            className="flex items-center gap-2 rounded-full border border-[#e0a35c]/28 bg-[#e0a35c]/10 px-5 py-2.5 text-sm text-[#e0a35c]/80 backdrop-blur transition hover:bg-[#e0a35c]/18"
          >
            View demo universe passport
          </button>
        </div>
      </section>

      {/* Identity Passport modal */}
      <IdentityPassportModal
        open={showPassport}
        onClose={() => setShowPassport(false)}
        profile={DEMO_PROFILE}
        model={model}
        comets={demoComets}
        isDemo
      />
    </div>
  )
}
