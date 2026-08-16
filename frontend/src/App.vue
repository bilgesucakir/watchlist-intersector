<script setup>
import { ref, computed, watch } from 'vue'

const USERNAME_CHECK_DEBOUNCE_MS = 500

const user1 = ref('')
const user2 = ref('')
const loading = ref(false)
const error = ref('')
const matches = ref(null)
const sameUsernameError = ref(false)

// Which search is in flight, used only to label the right button ('all' |
// 'tonight' | null). Whether the *last completed* search was random mode is
// tracked separately in lastSearchWasRandom, since it needs to survive after
// pendingAction resets back to null.
const pendingAction = ref(null)
const lastSearchWasRandom = ref(false)

// Usernames the current `matches` results actually came from, captured at
// search time so the CSV filename stays correct even if the inputs are
// edited afterward without re-searching.
const searchedUser1 = ref('')
const searchedUser2 = ref('')

// Each is null until checked (empty field, or check still pending), then true/false.
// watchlistPublic and avatarUrl are only meaningful once exists is true.
const user1Exists = ref(null)
const user2Exists = ref(null)
const user1WatchlistPublic = ref(null)
const user2WatchlistPublic = ref(null)
const user1AvatarUrl = ref(null)
const user2AvatarUrl = ref(null)

const hasEmptyField = computed(() => !user1.value.trim() || !user2.value.trim())
const canSubmit = computed(
  () =>
    !hasEmptyField.value &&
    user1WatchlistPublic.value === true &&
    user2WatchlistPublic.value === true &&
    !loading.value
)

const user1Error = computed(() => usernameFieldError(user1Exists.value, user1WatchlistPublic.value))
const user2Error = computed(() => usernameFieldError(user2Exists.value, user2WatchlistPublic.value))

function usernameFieldError(exists, watchlistPublic) {
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

function watchUsername(usernameRef, existsRef, watchlistPublicRef, avatarUrlRef) {
  let timer = null
  watch(usernameRef, (value) => {
    clearTimeout(timer)
    const trimmed = value.trim()
    existsRef.value = null
    watchlistPublicRef.value = null
    avatarUrlRef.value = null

    if (!trimmed) return

    timer = setTimeout(async () => {
      const result = await checkUsername(trimmed)
      // Ignore stale responses if the field changed again while this was in flight.
      if (usernameRef.value.trim() === trimmed) {
        existsRef.value = result.exists
        watchlistPublicRef.value = result.watchlistPublic
        avatarUrlRef.value = result.avatarUrl
      }
    }, USERNAME_CHECK_DEBOUNCE_MS)
  })
}

watchUsername(user1, user1Exists, user1WatchlistPublic, user1AvatarUrl)
watchUsername(user2, user2Exists, user2WatchlistPublic, user2AvatarUrl)

async function search(random) {
  error.value = ''
  matches.value = null
  sameUsernameError.value = false
  lastSearchWasRandom.value = random

  if (hasEmptyField.value) return

  const u1 = user1.value.trim()
  const u2 = user2.value.trim()

  if (u1.toLowerCase() === u2.toLowerCase()) {
    sameUsernameError.value = true
    return
  }

  loading.value = true
  pendingAction.value = random ? 'tonight' : 'all'

  const params = new URLSearchParams({ user1: u1, user2: u2 })
  if (random) params.set('random', 'true')

  try {
    const response = await fetch(`/api/intersect?${params}`)
    const body = await response.json()

    if (!response.ok) {
      error.value = body.error || 'Something went wrong.'
      return
    }

    matches.value = body
    searchedUser1.value = u1
    searchedUser2.value = u2
  } catch (e) {
    error.value = 'Could not reach the server. Please try again.'
  } finally {
    loading.value = false
    pendingAction.value = null
  }
}

function findAllMatches() {
  return search(false)
}

function findTonightsPick() {
  return search(true)
}

// Letterboxd's list-import CSV matches by title text, so the year needs to
// come from its own column rather than staying baked into "Title (Year)" —
// confirmed by test-importing a CSV built this way.
function csvTitle(title) {
  return title.replace(/\s*\(\d{4}\)\s*$/, '')
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv() {
  const rows = [
    ['Title', 'Year'],
    ...matches.value.map((film) => [csvTitle(film.title), film.year ?? ''])
  ]
  const csvContent = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${searchedUser1.value}_${searchedUser2.value}_watchlist_intersection.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <a
    class="github-link"
    href="https://github.com/bilgesucakir/watchlist-intersector"
    target="_blank"
    rel="noopener noreferrer"
  >
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
        .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
        -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
        1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
        1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
        1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
    <span>GitHub</span>
  </a>

  <main class="page">
    <h1>What We'll Watch Tonight</h1>
    <p class="subtitle">
      Pick something from both your Letterboxd watchlists — or see everything you have in common.
    </p>

    <form class="form" @submit.prevent="findTonightsPick">
      <div class="field">
        <div class="input-row">
          <input
            v-model="user1"
            type="text"
            placeholder="Letterboxd username 1"
            :disabled="loading"
            autocomplete="off"
          />
          <img v-if="user1AvatarUrl" :src="user1AvatarUrl" alt="" class="avatar" />
        </div>
        <p v-if="user1Error" class="field-error">{{ user1Error }}</p>
      </div>
      <div class="field">
        <div class="input-row">
          <input
            v-model="user2"
            type="text"
            placeholder="Letterboxd username 2"
            :disabled="loading"
            autocomplete="off"
          />
          <img v-if="user2AvatarUrl" :src="user2AvatarUrl" alt="" class="avatar" />
        </div>
        <p v-if="user2Error" class="field-error">{{ user2Error }}</p>
      </div>
      <button type="submit" :disabled="!canSubmit">
        {{ pendingAction === 'tonight' ? 'Searching…' : '🎲 Pick Something to Watch' }}
      </button>
      <button type="button" class="all-matches-button" :disabled="!canSubmit" @click="findAllMatches">
        {{ pendingAction === 'all' ? 'Searching…' : 'Return all films in both watchlists' }}
      </button>
    </form>

    <p v-if="loading" class="status loading">
      <span class="spinner" aria-hidden="true"></span>
      Scraping both watchlists, this can take a little while for large lists…
    </p>

    <p v-if="sameUsernameError" class="status error">
      Usernames must be different — enter two different Letterboxd usernames to compare their watchlists.
    </p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <template v-if="matches !== null && !loading">
      <p v-if="matches.length === 0" class="status">No films in common.</p>

      <template v-else-if="lastSearchWasRandom">
        <div class="picked-film">
          <img
            v-if="matches[0].posterUrl"
            :src="matches[0].posterUrl"
            :alt="matches[0].title"
            class="picked-poster"
          />
          <div v-else class="picked-poster poster-placeholder" aria-hidden="true"></div>
          <div class="picked-info">
            <p class="picked-label">Tonight's pick</p>
            <a
              :href="matches[0].url"
              target="_blank"
              rel="noopener noreferrer"
              class="picked-title"
            >{{ matches[0].title }}</a>
          </div>
        </div>
        <p class="tmdb-attribution">Posters from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
      </template>

      <template v-else>
        <ul class="results">
          <li v-for="film in matches" :key="film.url">
            <a :href="film.url" target="_blank" rel="noopener noreferrer">
              <img v-if="film.posterUrl" :src="film.posterUrl" :alt="film.title" class="poster" />
              <div v-else class="poster poster-placeholder" aria-hidden="true"></div>
              <span class="poster-title">{{ film.title }}</span>
            </a>
          </li>
        </ul>
        <button type="button" class="download-button download-button-small" @click="downloadCsv">Download CSV</button>
        <p class="tmdb-attribution">Posters from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></p>
      </template>
    </template>
  </main>
</template>

<style scoped>
:global(body) {
  background: #121212;
  margin: 0;
}

.github-link {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #e0e0e0;
  font-size: 0.9rem;
  text-decoration: none;
}

.github-link:hover {
  color: #4a8f63;
}

.page {
  max-width: 32rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
  font-family: system-ui, sans-serif;
  color: #f0f0f0;
}

h1 {
  margin-bottom: 0.25rem;
}

.subtitle {
  color: #999;
  margin-top: 0;
  margin-bottom: 2rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-row input {
  flex: 1;
  min-width: 0;
}

.avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #ccc;
}

.field-error {
  margin: 0;
  font-size: 0.85rem;
  color: #c0392b;
}

input,
button {
  font-size: 1rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.4rem;
  border: 1px solid #ccc;
}

input {
  background: #242424;
  color: #e0e0e0;
}

button {
  background: #4a8f63;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

button:disabled {
  background: #3d5c48;
  cursor: not-allowed;
}

.download-button {
  margin-top: 1.5rem;
  background: #e0e0e0;
  color: #4a8f63;
  border: 1px solid #4a8f63;
}

.download-button:hover {
  background: #cbe0d1;
}

.download-button-small {
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
}

.all-matches-button {
  background: transparent;
  color: #4a8f63;
  border: none;
  font-size: 0.95rem;
  font-weight: 400;
  padding: 0;
  align-self: center;
  cursor: pointer;
}

.all-matches-button:disabled {
  background: transparent;
  color: #3d5c48;
  cursor: not-allowed;
}

.all-matches-button:hover {
  text-decoration: underline;
}

.picked-film {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  border: 1px solid #4a8f63;
  border-radius: 0.75rem;
  background: #1a2620;
}

.picked-poster {
  width: 7rem;
  aspect-ratio: 2 / 3;
  border-radius: 0.5rem;
  object-fit: cover;
  background: #242424;
  flex-shrink: 0;
}

.picked-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
}

.picked-label {
  margin: 0;
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.picked-title {
  color: #e0e0e0;
  font-size: 1.1rem;
  font-weight: 600;
  text-decoration: none;
}

.picked-title:hover {
  color: #4a8f63;
}

.status {
  margin-top: 1.5rem;
}

.status.loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.spinner {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border: 2px solid #2e3f34;
  border-top-color: #4a8f63;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status.error {
  color: #c0392b;
}

.results {
  list-style: none;
  padding: 0;
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.results a {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: inherit;
  text-decoration: none;
}

.poster {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 0.4rem;
  object-fit: cover;
  background: #242424;
}

.poster-placeholder {
  border: 1px solid #333;
}

.poster-title {
  font-size: 0.8rem;
  color: #e0e0e0;
  text-align: center;
  line-height: 1.3;
}

.results a:hover .poster-title {
  color: #4a8f63;
}

.tmdb-attribution {
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: #777;
  text-align: center;
}

.tmdb-attribution a {
  color: #777;
}

.tmdb-attribution a:hover {
  color: #4a8f63;
}
</style>
