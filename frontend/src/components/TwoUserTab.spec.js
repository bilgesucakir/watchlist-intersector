import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TwoUserTab from './TwoUserTab.vue'

function jsonResponse(body, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body)
  })
}

describe('TwoUserTab', () => {
  let existsResponses
  let intersectImpl

  beforeEach(() => {
    existsResponses = {}
    intersectImpl = () => Promise.reject(new Error('intersect not mocked in this test'))

    global.fetch = vi.fn((url) => {
      const existsMatch = url.match(/^\/api\/users\/([^/]+)\/exists$/)
      if (existsMatch) {
        const username = decodeURIComponent(existsMatch[1])
        const result = existsResponses[username] ?? { exists: true, watchlistPublic: true }
        return jsonResponse(result)
      }
      return intersectImpl(url)
    })

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function setUsernames(wrapper, user1, user2) {
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue(user1)
    await inputs[1].setValue(user2)
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
  }

  it('disables both search buttons until both usernames are filled in and verified', async () => {
    const wrapper = mount(TwoUserTab)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.all-matches-button').attributes('disabled')).toBeDefined()

    await setUsernames(wrapper, 'alice', 'bob')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.all-matches-button').attributes('disabled')).toBeUndefined()
  })

  it('shows an error and keeps the buttons disabled when a username does not exist', async () => {
    existsResponses = { ghost: { exists: false, watchlistPublic: false } }

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'ghost')

    expect(wrapper.text()).toContain("This username doesn't exist on Letterboxd.")
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.all-matches-button').attributes('disabled')).toBeDefined()
  })

  it('shows a different error and keeps the buttons disabled when the watchlist is private', async () => {
    existsResponses = { bob: { exists: true, watchlistPublic: false } }

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')

    expect(wrapper.text()).toContain("This user's watchlist isn't public, or is empty.")
    expect(wrapper.text()).not.toContain("doesn't exist")
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('shows the avatar next to a field once its username is verified', async () => {
    existsResponses = {
      alice: { exists: true, watchlistPublic: true, avatarUrl: 'https://a.ltrbxd.com/resized/avatar/alice.jpg' }
    }

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')

    const avatars = wrapper.findAll('.avatar')
    expect(avatars).toHaveLength(1)
    expect(avatars[0].attributes('src')).toBe('https://a.ltrbxd.com/resized/avatar/alice.jpg')
  })

  it('does not show an avatar when the username check has no avatar url', async () => {
    existsResponses = { ghost: { exists: false, watchlistPublic: false, avatarUrl: null } }

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'ghost')

    expect(wrapper.findAll('.avatar')).toHaveLength(0)
  })

  it('debounces the existence check while typing', async () => {
    const wrapper = mount(TwoUserTab)
    const input = wrapper.findAll('input')[0]

    await input.setValue('al')
    await vi.advanceTimersByTimeAsync(200)
    await input.setValue('alice')
    await vi.advanceTimersByTimeAsync(200)

    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/users\//))

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/api/users/alice/exists')
    expect(global.fetch).not.toHaveBeenCalledWith('/api/users/al/exists')
  })

  it('does not call the intersect API when a username is missing', async () => {
    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', '')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/intersect/))
  })

  it('allows typing the same username in both fields but rejects submitting it', async () => {
    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'alice')

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Usernames must be different')
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/intersect/))
  })

  it('the primary action requests a single random pick and shows it highlighted', async () => {
    intersectImpl = () =>
      jsonResponse([
        {
          title: 'Anora',
          url: 'https://letterboxd.com/film/anora/',
          posterUrl: 'https://image.tmdb.org/t/p/w342/anora.jpg'
        }
      ])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/api/intersect?user1=alice&user2=bob&random=true')
    expect(wrapper.find('.picked-title').text()).toBe('Anora')
    expect(wrapper.find('.picked-title').attributes('href')).toBe('https://letterboxd.com/film/anora/')
    expect(wrapper.find('.picked-poster').attributes('src')).toBe('https://image.tmdb.org/t/p/w342/anora.jpg')
    expect(wrapper.text()).toContain('TMDB')
    expect(wrapper.find('.results').exists()).toBe(false)
  })

  it('shows a placeholder poster for the tonight pick when there is no poster', async () => {
    intersectImpl = () =>
      jsonResponse([{ title: 'Anora', url: 'https://letterboxd.com/film/anora/', posterUrl: null }])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('img.picked-poster').exists()).toBe(false)
    expect(wrapper.find('.picked-poster.poster-placeholder').exists()).toBe(true)
  })

  it('clicking the primary button again requests a fresh random pick (no dedicated reroll button)', async () => {
    let callCount = 0
    intersectImpl = () => {
      callCount += 1
      return jsonResponse([
        {
          title: callCount === 1 ? 'Anora' : 'Dune: Part Two',
          url: 'https://letterboxd.com/film/anora/',
          posterUrl: null
        }
      ])
    }

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.picked-title').text()).toBe('Anora')
    expect(wrapper.find('.reroll-button').exists()).toBe(false)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.picked-title').text()).toBe('Dune: Part Two')
    expect(global.fetch).toHaveBeenCalledWith('/api/intersect?user1=alice&user2=bob&random=true')
  })

  it('requests all matches and renders the poster grid when the secondary button is clicked', async () => {
    intersectImpl = () =>
      jsonResponse([
        {
          title: 'Anora',
          url: 'https://letterboxd.com/film/anora/',
          posterUrl: 'https://image.tmdb.org/t/p/w342/anora.jpg'
        }
      ])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('.all-matches-button').trigger('click')
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/api/intersect?user1=alice&user2=bob')
    expect(wrapper.find('.results a').attributes('href')).toBe('https://letterboxd.com/film/anora/')
    expect(wrapper.find('.poster').attributes('src')).toBe('https://image.tmdb.org/t/p/w342/anora.jpg')
    expect(wrapper.find('.picked-film').exists()).toBe(false)
  })

  it('shows a placeholder instead of an img in the grid when a match has no poster', async () => {
    intersectImpl = () =>
      jsonResponse([{ title: 'Anora', url: 'https://letterboxd.com/film/anora/', posterUrl: null }])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('.all-matches-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('img.poster').exists()).toBe(false)
    expect(wrapper.find('.poster-placeholder').exists()).toBe(true)
  })

  it('switches from the tonight-pick view to the full grid when all matches is requested next', async () => {
    intersectImpl = () =>
      jsonResponse([{ title: 'Anora', url: 'https://letterboxd.com/film/anora/', posterUrl: null }])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.picked-film').exists()).toBe(true)

    await wrapper.find('.all-matches-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.picked-film').exists()).toBe(false)
    expect(wrapper.find('.results').exists()).toBe(true)
  })

  it('does not show a download button when there are no matches', async () => {
    intersectImpl = () => jsonResponse([])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('.all-matches-button').trigger('click')
    await flushPromises()

    expect(wrapper.find('.download-button').exists()).toBe(false)
  })

  it('downloads a CSV with year in its own column and a user1_user2 filename', async () => {
    intersectImpl = () =>
      jsonResponse([
        { title: 'The Godfather (1972)', url: 'https://letterboxd.com/film/the-godfather/', year: 1972 },
        { title: 'Parasite (2019)', url: 'https://letterboxd.com/film/parasite/', year: 2019 }
      ])

    const OriginalBlob = global.Blob
    let capturedParts = null
    global.Blob = vi.fn((parts, options) => {
      capturedParts = parts
      return new OriginalBlob(parts, options)
    })
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    const originalCreateElement = document.createElement.bind(document)
    let createdAnchor = null
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') createdAnchor = el
      return el
    })

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('.all-matches-button').trigger('click')
    await flushPromises()

    await wrapper.find('.download-button').trigger('click')

    expect(createdAnchor.download).toBe('alice_bob_watchlist_intersection.csv')
    expect(capturedParts[0]).toBe('Title,Year\r\nThe Godfather,1972\r\nParasite,2019')

    global.Blob = OriginalBlob
  })

  it('shows the server error message when a watchlist is inaccessible', async () => {
    intersectImpl = () => jsonResponse({ error: 'Watchlist inaccessible for: bob' }, false)

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Watchlist inaccessible for: bob')
  })

  it('shows a no-matches message when the intersection is empty', async () => {
    intersectImpl = () => jsonResponse([])

    const wrapper = mount(TwoUserTab)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No films in common.')
  })
})
