# Melody Map Mobile Readiness Checklist

## Scope
- Mobile web only
- Not a native-app certification
- Focused on existing routes and browser usability

## Tested viewport targets
- `360 x 800` Android small handset
- `375 x 812` iPhone X / 12 mini class
- `390 x 844` modern iPhone class
- `412 x 915` large Android handset
- `768 x 1024` tablet portrait sanity check

## Routes tested
- `/`
- `/discover`
- `/auralith`
- `/galaxy`
- `/identity`
- `/identity-drift`
- `/soulmates`
- `/analytics`
- `/aesthetic`
- `/login`
- `/spotify/success`
- `/lastfm/success`

## Mobile QA checklist
- No horizontal page overflow on primary routes
- Bottom navigation remains visible without covering primary actions
- Top bar does not crowd search/actions on narrow screens
- Safe-area bottom padding present for home-indicator devices
- Loading and error states do not collapse into blank pages
- Primary actions remain reachable with one-hand tap targets
- Textareas and cards do not clip when the viewport shortens
- Hero panels and stat grids collapse cleanly on small widths
- Route entry links use the active `/soulmates` social path
- Touch-only users can discover actions without hover

## OAuth mobile notes
- Spotify and Last.fm callback pages must hydrate provider state without requiring desktop-only redirects
- Callback pages should not assume token query strings; they should accept `auth_code`
- Post-auth screens should render a visible handoff state instead of a blank page
- Protected shell fallbacks should remain visible on refresh while auth/bootstrap settles

## WebGL fallback notes
- Galaxy should reduce DPR and postprocessing in low-power or reduced-motion contexts
- Galaxy should render a non-WebGL fallback panel when WebGL is unavailable
- Soul Orb should disable live/power-heavy effects in low-power mode
- `prefers-reduced-motion` should dampen heavy motion and hover-only polish

## Export/share notes
- Identity card export must fit narrow mobile widths without clipping
- On mobile Safari-like browsers, PNG export may need to open in a new tab for manual save
- Copy-share-text should fall back when Clipboard API is unavailable

## Known limitations
- 3D scenes are mobile-safe, but still heavier than ordinary cards on very low-end devices
- Mobile browser download behavior is inconsistent; image-preview fallback is expected on some browsers
- The legacy `Navbar` component is not part of the primary shell, but its route targets were aligned for safety
- Keyboard overlap has been reduced by avoiding brittle `100vh` shells, but full device-specific keyboard QA still requires manual browser testing

## Phone QA runbook
1. Open the app on a narrow viewport or physical phone.
2. Verify Dashboard loads without hero/button overlap.
3. Switch routes through BottomNav and confirm active state updates.
4. Refresh on a protected route and confirm the shell recovers without a blank page.
5. Open Discover and confirm tabs, cards, and regenerate actions remain tappable.
6. Open Auralith and confirm prompt chips, textareas, and action buttons remain usable.
7. Open Galaxy and verify either adaptive 3D mode or the fallback panel appears.
8. Open Identity and export the share card on a narrow viewport.
9. Open Social Soulmates and confirm privacy/match actions remain reachable.
10. Simulate reduced motion and verify the experience becomes calmer rather than broken.
