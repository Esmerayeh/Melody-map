import { motion } from 'framer-motion'
import {
  Archive,
  BarChart3,
  Cookie,
  Database,
  ExternalLink,
  KeyRound,
  Lock,
  Mail,
  Music2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCog,
} from 'lucide-react'
import AtmosphereBackground from '../components/premium/AtmosphereBackground'
import ShimmerDivider from '../components/premium/ShimmerDivider'
import { MOTION_TOKENS } from '../features/motion/motionTokens'

const LAST_UPDATED = 'May 7, 2026'
const CONTACT_EMAIL = 'privacy@melodymap.example'

const sections = [
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    icon: Database,
    accent: '#b59cff',
    intro: 'Melody Map only asks for the signals it needs to shape your music identity, visual worlds, and discovery experience.',
    points: [
      'Spotify profile and listening data you authorize, such as display name, profile image, top artists, top tracks, saved tracks, playlist metadata, recently played tracks, and audio-feature style signals when available.',
      'Account information such as username, email address, authentication state, and basic settings needed to operate your Melody Map account.',
      'Usage analytics such as page visits, feature interactions, recommendation impressions, saves, skips, clicks, errors, and performance events.',
      'Optional profile and customization data, including music identity labels, soulmate sharing preferences, visual themes, aesthetic tags, and exported identity-card metadata.',
    ],
  },
  {
    id: 'spotify-third-party-integrations',
    title: 'Spotify & Third-Party Integrations',
    icon: Music2,
    accent: '#82e8a5',
    intro: 'Your connected music services remain governed by their own permissions and policies. Melody Map uses them to translate listening history into an experience, not to take ownership of it.',
    points: [
      'Spotify API data is accessed only after you grant permission through Spotify OAuth. You can revoke Melody Map access anytime from your Spotify account settings.',
      'Last.fm API data may be used when you connect Last.fm to enrich scrobble history, top artists, and listening patterns.',
      'Pinterest API may be used for optional or future aesthetic-board integrations when you choose visual discovery features.',
      'Analytics, hosting, database, cache, and observability providers may process limited technical data so the platform can remain secure, reliable, and fast.',
    ],
  },
  {
    id: 'how-your-data-is-used',
    title: 'How Your Data Is Used',
    icon: Sparkles,
    accent: '#f2a0df',
    intro: 'We use your data to make Melody Map feel personal, responsive, and emotionally accurate.',
    points: [
      'Build your music profile, identity reading, soul orb, music galaxy, analytics views, and playlist-aesthetic surfaces.',
      'Generate recommendations, explanations, compatibility scores, soulmate constellations, and discovery contexts.',
      'Improve reliability, prevent abuse, debug errors, measure feature quality, and understand aggregate product usage.',
      'Remember your preferences across sessions, including provider state, visual settings, privacy choices, and cached profile readiness.',
    ],
  },
  {
    id: 'cookies-analytics',
    title: 'Cookies & Analytics',
    icon: Cookie,
    accent: '#9fd0ff',
    intro: 'Cookies help the app keep a secure session and avoid making you rebuild your listening world every time you return.',
    points: [
      'Melody Map may use secure session cookies, provider connection cookies, CSRF protection cookies, and local preference storage.',
      'Analytics may be used to understand product health, route performance, recommendation quality, feature adoption, and error patterns.',
      'Where legally required, we will provide consent controls for non-essential analytics or similar tracking technologies.',
      'You can usually control cookies through your browser settings, though disabling some cookies may break login or connected music features.',
    ],
  },
  {
    id: 'data-storage-security',
    title: 'Data Storage & Security',
    icon: Lock,
    accent: '#a9d4ff',
    intro: 'Security is part of the product experience. Your listening identity should feel protected, not exposed.',
    points: [
      'Melody Map uses secure authentication patterns and encrypted transmission over HTTPS/TLS wherever data moves between your browser and our services.',
      'Access tokens, session cookies, and provider credentials are handled with care and are not intentionally exposed in public URLs.',
      'We use technical and organizational safeguards such as access controls, rate limits, CSRF protection, logging, and monitoring.',
      'No internet service can be guaranteed perfectly secure, but we work to reduce risk and respond quickly to suspected issues.',
    ],
  },
  {
    id: 'sharing-disclosure',
    title: 'Sharing & Disclosure',
    icon: ShieldCheck,
    accent: '#cbb1ff',
    intro: 'Melody Map does not sell personal data. Sharing is limited to operating the service, respecting your choices, and meeting legal obligations.',
    points: [
      'We may share limited data with service providers who help run hosting, storage, analytics, authentication, email, security, observability, or similar infrastructure.',
      'We may disclose data if required by law, legal process, safety obligations, or to protect Melody Map, users, and the integrity of the platform.',
      'Soulmate links, public profile surfaces, and exported cards may reveal information you choose to share. Use privacy settings thoughtfully before sharing.',
      'We do not sell personal data, listening history, music identity profiles, or soulmate compatibility data.',
    ],
  },
  {
    id: 'your-rights-choices',
    title: 'Your Rights & Choices',
    icon: UserRoundCog,
    accent: '#f8c67e',
    intro: 'You should be able to understand and shape what happens to your music identity.',
    points: [
      'Depending on your location, including under GDPR or CCPA-style laws, you may request access, correction, deletion, portability, restriction, or objection regarding your personal data.',
      'You may revoke Spotify permissions through Spotify account settings and disconnect music providers from Melody Map where supported.',
      'You may adjust profile visibility, public sharing, and soulmate matching preferences where those controls are available.',
      'You may contact us to ask what data is associated with your account or to request a privacy review.',
    ],
  },
  {
    id: 'account-deletion',
    title: 'Account Deletion',
    icon: Trash2,
    accent: '#f5a6c9',
    intro: 'Leaving should not feel like a maze.',
    points: [
      `You may request account deletion by contacting ${CONTACT_EMAIL} from the email associated with your Melody Map account.`,
      'Deletion requests may include account records, stored music profile snapshots, personalization data, public sharing settings, and other personal data we no longer need to retain.',
      'Some information may be retained for a limited period where required for security, fraud prevention, legal compliance, backups, dispute resolution, or legitimate business records.',
      'Disconnecting Spotify or Last.fm does not automatically delete your Melody Map account; it only revokes or removes that provider connection.',
    ],
  },
  {
    id: 'contact-information',
    title: 'Contact Information',
    icon: Mail,
    accent: '#88b8d8',
    intro: 'Questions about privacy should get a real answer, not disappear into static.',
    points: [
      `For privacy questions, rights requests, or account deletion, contact us at ${CONTACT_EMAIL}.`,
      'Please include enough detail for us to identify your account and understand the request, but do not send sensitive passwords or access tokens.',
      'We may ask you to verify account ownership before completing certain privacy or deletion requests.',
    ],
  },
]

function PolicyHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOTION_TOKENS.focusSettle}
      className="noire-panel relative overflow-hidden rounded-[36px] px-6 py-10 sm:px-8 lg:px-10"
    >
      <AtmosphereBackground variant="oracle" intensity="rich" anchored />
      <div className="relative z-10 max-w-4xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          <KeyRound className="h-3.5 w-3.5 text-brand-purple" />
          Last updated {LAST_UPDATED}
        </div>
        <p className="page-header-kicker mb-3">Melody Map Trust Layer</p>
        <h1 className="page-header-title">Privacy Policy</h1>
        <p className="page-header-copy mt-5 text-base sm:text-lg">
          Your music identity stays yours. This policy explains how Melody Map handles the listening signals, profile details,
          and visual-discovery data that make the experience feel personal.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            ['No data sales', 'We do not sell personal data or listening history.'],
            ['Permission based', 'Music integrations start with your consent.'],
            ['Revocable access', 'Spotify access can be revoked from Spotify settings.'],
          ].map(([label, copy]) => (
            <div key={label} className="rounded-[22px] border border-white/8 bg-white/[0.035] p-4 backdrop-blur">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function TableOfContents() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 rounded-[28px] border border-white/8 bg-[rgba(10,9,24,0.7)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
        <p className="section-label mb-4">Policy Map</p>
        <nav aria-label="Privacy policy sections" className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-white/[0.045] hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
              >
                <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-brand-purple" />
                <span>{section.title}</span>
              </a>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

function MobileToc() {
  return (
    <div className="lg:hidden">
      <div className="mobile-scroll-row flex gap-2 overflow-x-auto pb-2" aria-label="Privacy policy sections">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="noire-chip shrink-0 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
          >
            {section.title}
          </a>
        ))}
      </div>
    </div>
  )
}

function PolicySection({ section, index }) {
  const Icon = section.icon
  return (
    <motion.section
      id={section.id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...MOTION_TOKENS.panel, delay: Math.min(index * 0.03, 0.18) }}
      className="scroll-mt-8"
    >
      <div className="noire-info-card rounded-[28px] p-5 sm:p-6">
        <div className="relative z-10">
          <div className="mb-5 flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                color: section.accent,
                borderColor: `${section.accent}38`,
                background: `${section.accent}16`,
                boxShadow: `0 0 24px ${section.accent}14`,
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="section-label mb-2">Section {String(index + 1).padStart(2, '0')}</p>
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{section.intro}</p>
            </div>
          </div>

          <ShimmerDivider className="mb-5" />

          <ul className="space-y-3">
            {section.points.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-7 text-slate-300">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: section.accent, boxShadow: `0 0 12px ${section.accent}` }}
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  )
}

function ClosingPanel() {
  return (
    <section className="noire-orb-panel rounded-[32px] p-6 sm:p-7">
      <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Archive className="h-4 w-4 text-brand-purple" />
            <p className="section-label">A note on trust</p>
          </div>
          <h2 className="text-2xl font-semibold text-white">Privacy should feel as intentional as the product.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Melody Map is built around personal listening identity. That makes privacy a design requirement, not a footer
            afterthought. We will update this policy as the platform grows, especially as integrations, analytics, and sharing
            features evolve.
          </p>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="halo-button halo-secondary w-full sm:w-auto"
        >
          <Mail className="h-4 w-4" />
          Contact privacy
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  )
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen overflow-hidden app-shell-bg">
      <main className="cosmic-page max-w-7xl">
        <div className="pointer-events-none absolute left-[8%] top-24 h-72 w-72 rounded-full bg-brand-purple/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-[5%] top-[38rem] h-80 w-80 rounded-full bg-brand-pink/8 blur-3xl" aria-hidden="true" />

        <PolicyHero />
        <div className="mt-6">
          <MobileToc />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <TableOfContents />
          <div className="space-y-5">
            <section className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5 text-sm leading-7 text-slate-300 backdrop-blur">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-1 h-5 w-5 shrink-0 text-brand-blue" />
                <p>
                  This policy is written to be readable, but it is still a real privacy notice. It applies to Melody Map’s
                  music identity, discovery, visualization, recommendation, sharing, and account features.
                </p>
              </div>
            </section>

            {sections.map((section, index) => (
              <PolicySection key={section.id} section={section} index={index} />
            ))}

            <ClosingPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
