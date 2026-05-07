import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIdentityShareText } from '../src/components/identity/identityCardExport.js'

test('buildIdentityShareText includes archetype and mbti', () => {
  const text = buildIdentityShareText({
    archetype: 'Nocturnal Dreamer',
    mbti: 'INFP',
    topGenres: ['dream pop', 'shoegaze'],
    moodLabel: 'melancholic',
  })
  assert.match(text, /Nocturnal Dreamer/)
  assert.match(text, /INFP/)
  assert.match(text, /dream pop/)
})
