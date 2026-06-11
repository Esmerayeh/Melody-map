import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIdentityShareText } from '../src/components/identity/identityCardExport.js'

test('buildIdentityShareText includes identity and genre context', () => {
  const text = buildIdentityShareText({
    archetype: 'Nocturnal Dreamer',
    identityType: 'The Dream Archivist',
    topGenres: ['dream pop', 'shoegaze'],
    moodLabel: 'melancholic',
  })
  assert.match(text, /The Dream Archivist/)
  assert.match(text, /dream pop/)
})
