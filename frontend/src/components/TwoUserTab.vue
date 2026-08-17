<script setup>
import { ref, computed } from 'vue'
import { useUsernameCheck, usernameFieldError } from '../composables/useUsernameCheck'
import { downloadFilmsAsCsv } from '../utils/csv'

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

const { exists: user1Exists, watchlistPublic: user1WatchlistPublic, avatarUrl: user1AvatarUrl } =
  useUsernameCheck(user1)
const { exists: user2Exists, watchlistPublic: user2WatchlistPublic, avatarUrl: user2AvatarUrl } =
  useUsernameCheck(user2)

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

function downloadCsv() {
  downloadFilmsAsCsv(matches.value, `${searchedUser1.value}_${searchedUser2.value}_watchlist_intersection.csv`)
}
</script>

<template>
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
          placeholder="enter Letterboxd username"
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
          placeholder="enter Letterboxd username"
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
</template>

<style scoped>
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
