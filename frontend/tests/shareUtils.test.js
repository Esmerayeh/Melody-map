import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIdentityShareText,
  buildSoulOrbShareText,
  buildSoulmateShareText,
  buildWhatsAppUrl,
  getInstagramStoryInstructions,
  normalizeSoulmateLink,
} from '../src/utils/shareUtils.js'

test('buildIdentityShareText keeps music identity and genre context', () => {
  const text = buildIdentityShareText({
    personality: [{ label: 'Nocturnal Dreamer' }],
    mbti: { type: 'INFP' },
    genres: ['dream pop', 'shoegaze'],
    analyticsMetrics: { mood: 'melancholic' },
  })
  assert.match(text, /Nocturnal Dreamer/)
  assert.match(text, /dream pop/)
})

test('buildWhatsAppUrl safely encodes text and url', () => {
  const url = buildWhatsAppUrl({ text: 'Music identity: INFP', url: 'https://melodymap.site/identity?x=1' })
  assert.match(url, /^https:\/\/wa\.me\/\?text=/)
  assert.match(decodeURIComponent(url), /Music identity: INFP/)
})

test('buildSoulOrbShareText summarizes orb without raw listening history', () => {
  const text = buildSoulOrbShareText({ sonicPersonalityTitle: 'Silver Dreamer', mbti: { type: 'INFJ' }, analyticsMetrics: { mood: 'moonlit' } })
  assert.match(text, /Silver Dreamer/)
  assert.match(text, /moonlit/)
})

test('buildSoulmateShareText uses names and rounded compatibility', () => {
  const text = buildSoulmateShareText({ userAName: 'Ari', userBName: 'Mira', overallCompatibility: 87.6, relationshipArchetype: 'Twin moons' })
  assert.match(text, /Ari/)
  assert.match(text, /Mira/)
  assert.match(text, /88%/)
})

test('normalizeSoulmateLink extracts public slug and rejects empty malformed input gracefully', () => {
  assert.equal(normalizeSoulmateLink('https://melodymap.site/soulmate/silver-orbit?x=1'), 'silver-orbit')
  assert.equal(normalizeSoulmateLink('https://melodymap.site/soulmates/silver-orbit?x=1'), 'silver-orbit')
  assert.equal(normalizeSoulmateLink('/soulmate/moon-field'), 'moon-field')
  assert.equal(normalizeSoulmateLink('/soulmates/moon-field'), 'moon-field')
  assert.equal(normalizeSoulmateLink(''), '')
})

test('Instagram helper is honest about web limitations', () => {
  assert.match(getInstagramStoryInstructions(), /Download this card/)
})
