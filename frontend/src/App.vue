<script setup>
import { ref, computed } from 'vue'

const user1 = ref('')
const user2 = ref('')
const loading = ref(false)
const error = ref('')
const matches = ref(null)
const sameUsernameError = ref(false)

const hasEmptyField = computed(() => !user1.value.trim() || !user2.value.trim())
const canSubmit = computed(() => !hasEmptyField.value && !loading.value)

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
  } catch (e) {
    error.value = 'Could not reach the server. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="page">
    <h1>Watchlist Intersector</h1>
    <p class="subtitle">Find films on both Letterboxd users' watchlists.</p>

    <form class="form" @submit.prevent="findMatches">
      <input
        v-model="user1"
        type="text"
        placeholder="Letterboxd username 1"
        :disabled="loading"
        autocomplete="off"
      />
      <input
        v-model="user2"
        type="text"
        placeholder="Letterboxd username 2"
        :disabled="loading"
        autocomplete="off"
      />
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
      <ul v-else class="results">
        <li v-for="film in matches" :key="film.url">
          <a :href="film.url" target="_blank" rel="noopener noreferrer">{{ film.title }}</a>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
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
