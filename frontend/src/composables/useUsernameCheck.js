import { ref, watch } from 'vue'

const DEBOUNCE_MS = 500

export function usernameFieldError(exists, watchlistPublic) {
  if (exists === false) return "This username doesn't exist on Letterboxd."
  if (exists === true && watchlistPublic === false) return "This user's watchlist isn't public, or is empty."
  return null
}

async function checkUsername(username) {
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/exists`)
    if (!response.ok) return { exists: false, watchlistPublic: false, avatarUrl: null }
    const body = await response.json()
    return {
      exists: body.exists === true,
      watchlistPublic: body.watchlistPublic === true,
      avatarUrl: body.avatarUrl ?? null
    }
  } catch (e) {
    return { exists: false, watchlistPublic: false, avatarUrl: null }
  }
}

// Debounced existence/avatar check for a username ref, shared by every tab
// that has a username input. Guards against stale responses landing after
// the field has changed again while the check was in flight.
export function useUsernameCheck(usernameRef) {
  const exists = ref(null)
  const watchlistPublic = ref(null)
  const avatarUrl = ref(null)

  let timer = null
  watch(usernameRef, (value) => {
    clearTimeout(timer)
    const trimmed = value.trim()
    exists.value = null
    watchlistPublic.value = null
    avatarUrl.value = null

    if (!trimmed) return

    timer = setTimeout(async () => {
      const result = await checkUsername(trimmed)
      if (usernameRef.value.trim() === trimmed) {
        exists.value = result.exists
        watchlistPublic.value = result.watchlistPublic
        avatarUrl.value = result.avatarUrl
      }
    }, DEBOUNCE_MS)
  })

  return { exists, watchlistPublic, avatarUrl }
}
