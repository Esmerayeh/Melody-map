import {
  buildIdentityShareText as buildIdentityText,
  downloadElementAsPng,
} from '../../utils/shareUtils.js'

export async function exportElementAsPng(element, filename = 'melody-map-identity-card.png') {
  return downloadElementAsPng(element, filename)
}

export function buildIdentityShareText({ archetype, identityType, topGenres = [], moodLabel }) {
  const name = identityType || archetype
  return buildIdentityText({
    personality: archetype ? [{ label: archetype }] : [],
    sonicPersonalityTitle: name,
    musicIdentity: name ? { type: { name } } : null,
    genres: topGenres,
    analyticsMetrics: { mood: moodLabel },
  })
}
