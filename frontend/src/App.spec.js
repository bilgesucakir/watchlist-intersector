import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from './App.vue'

function jsonResponse(body, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body)
  })
}

describe('App', () => {
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

  it('disables the submit button until both usernames are filled in and verified', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()

    await setUsernames(wrapper, 'alice', 'bob')
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })

  it('shows an error and keeps the button disabled when a username does not exist', async () => {
    existsResponses = { ghost: { exists: false, watchlistPublic: false } }

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'ghost')

    expect(wrapper.text()).toContain("This username doesn't exist on Letterboxd.")
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows a different error and keeps the button disabled when the watchlist is private', async () => {
    existsResponses = { bob: { exists: true, watchlistPublic: false } }

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')

    expect(wrapper.text()).toContain("This user's watchlist isn't public.")
    expect(wrapper.text()).not.toContain("doesn't exist")
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('debounces the existence check while typing', async () => {
    const wrapper = mount(App)
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
    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', '')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/intersect/))
  })

  it('allows typing the same username in both fields but rejects submitting it', async () => {
    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'alice')

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Usernames must be different')
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringMatching(/^\/api\/intersect/))
  })

  it('requests the intersection and renders matches on success', async () => {
    intersectImpl = () =>
      jsonResponse([{ title: 'Anora', url: 'https://letterboxd.com/film/anora/' }])

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/api/intersect?user1=alice&user2=bob')
    expect(wrapper.text()).toContain('Anora')
    expect(wrapper.find('.results a').attributes('href')).toBe('https://letterboxd.com/film/anora/')
  })

  it('shows the server error message when a watchlist is inaccessible', async () => {
    intersectImpl = () => jsonResponse({ error: 'Watchlist inaccessible for: bob' }, false)

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Watchlist inaccessible for: bob')
  })

  it('shows a no-matches message when the intersection is empty', async () => {
    intersectImpl = () => jsonResponse([])

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No films in common.')
  })
})
