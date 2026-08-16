<script setup>
import { ref, computed, watch } from 'vue'

const USERNAME_CHECK_DEBOUNCE_MS = 500

const user1 = ref('')
const user2 = ref('')
const loading = ref(false)
const error = ref('')
const matches = ref(null)
const sameUsernameError = ref(false)

// Usernames the current `matches` results actually came from, captured at
// search time so the CSV filename stays correct even if the inputs are
// edited afterward without re-searching.
const searchedUser1 = ref('')
const searchedUser2 = ref('')

// Each is null until checked (empty field, or check still pending), then true/false.
// watchlistPublic is only meaningful once exists is true.
const user1Exists = ref(null)
const user2Exists = ref(null)
const user1WatchlistPublic = ref(null)
const user2WatchlistPublic = ref(null)

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
  if (exists === true && watchlistPublic === false) return "This user's watchlist isn't public."
  return null
}

async function checkUsername(username) {
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/exists`)
    if (!response.ok) return { exists: false, watchlistPublic: false }
    const body = await response.json()
    return { exists: body.exists === true, watchlistPublic: body.watchlistPublic === true }
  } catch (e) {
    return { exists: false, watchlistPublic: false }
  }
}

function watchUsername(usernameRef, existsRef, watchlistPublicRef) {
  let timer = null
  watch(usernameRef, (value) => {
    clearTimeout(timer)
    const trimmed = value.trim()
    existsRef.value = null
    watchlistPublicRef.value = null

    if (!trimmed) return

    timer = setTimeout(async () => {
      const result = await checkUsername(trimmed)
      // Ignore stale responses if the field changed again while this was in flight.
      if (usernameRef.value.trim() === trimmed) {
        existsRef.value = result.exists
        watchlistPublicRef.value = result.watchlistPublic
      }
    }, USERNAME_CHECK_DEBOUNCE_MS)
  })
}

watchUsername(user1, user1Exists, user1WatchlistPublic)
watchUsername(user2, user2Exists, user2WatchlistPublic)

async function findMatches() {
  error.value = ''
  matches.value = null
  sameUsernameError.value = false

  if (hasEmptyField.value) return

  const u1 = user1.value.trim()
  const u2 = user2.value.trim()

  if (u1.toLowerCase() === u2.toLowerCase()) {
    sameUsernameError.value = true
    return
  }

  loading.value = true

  const params = new URLSearchParams({ user1: u1, user2: u2 })

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
  }
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
    <span>watchlist-intersector on GitHub</span>
  </a>

  <main class="page">
    <h1>Watchlist Intersector</h1>
    <p class="subtitle">Find films on both Letterboxd users' watchlists.</p>

    <form class="form" @submit.prevent="findMatches">
      <div class="field">
        <input
          v-model="user1"
          type="text"
          placeholder="Letterboxd username 1"
          :disabled="loading"
          autocomplete="off"
        />
        <p v-if="user1Error" class="field-error">{{ user1Error }}</p>
      </div>
      <div class="field">
        <input
          v-model="user2"
          type="text"
          placeholder="Letterboxd username 2"
          :disabled="loading"
          autocomplete="off"
        />
        <p v-if="user2Error" class="field-error">{{ user2Error }}</p>
      </div>
      <button type="submit" :disabled="!canSubmit">
        {{ loading ? 'Searching…' : 'Find matches' }}
      </button>
    </form>

    <p v-if="loading" class="status">
      Scraping both watchlists, this can take a little while for large lists…
    </p>

    <p v-if="sameUsernameError" class="status error">
      Usernames must be different — enter two different Letterboxd usernames to compare their watchlists.
    </p>
    <p v-else-if="error" class="status error">{{ error }}</p>

    <template v-if="matches !== null && !loading">
      <p v-if="matches.length === 0" class="status">No films in common.</p>
      <template v-else>
        <button type="button" class="download-button" @click="downloadCsv">Download CSV</button>
        <ul class="results">
          <li v-for="film in matches" :key="film.url">
            <a :href="film.url" target="_blank" rel="noopener noreferrer">{{ film.title }}</a>
          </li>
        </ul>
      </template>
    </template>
  </main>
</template>

<style scoped>
.github-link {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #333;
  font-size: 0.9rem;
  text-decoration: none;
}

.github-link:hover {
  color: #00c030;
}

.page {
  max-width: 32rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
  font-family: system-ui, sans-serif;
}

h1 {
  margin-bottom: 0.25rem;
}

.subtitle {
  color: #666;
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

button {
  background: #00c030;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

button:disabled {
  background: #9ad6ac;
  cursor: not-allowed;
}

.download-button {
  margin-top: 1.5rem;
  background: #fff;
  color: #00c030;
  border: 1px solid #00c030;
}

.download-button:hover {
  background: #eafbef;
}

.status {
  margin-top: 1.5rem;
}

.status.error {
  color: #c0392b;
}

.results {
  list-style: none;
  padding: 0;
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.results a {
  color: #00c030;
  text-decoration: none;
  font-weight: 500;
}

.results a:hover {
  text-decoration: underline;
}
</style>
