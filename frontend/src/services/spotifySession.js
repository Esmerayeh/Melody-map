function safeStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function clearSpotifyStorage() {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.removeItem('spotify_token')
    storage.removeItem('spotify_refresh_token')
    storage.removeItem('spotify_token_expiry')
  } catch {
    // Ignore storage cleanup failures.
  }
}
