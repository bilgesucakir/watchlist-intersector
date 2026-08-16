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
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setUsernames(wrapper, user1, user2) {
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue(user1)
    await inputs[1].setValue(user2)
  }

  it('disables the submit button until both usernames are filled in', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()

    await setUsernames(wrapper, 'alice', 'bob')
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })

  it('does not call the API when a username is missing', async () => {
    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', '')

    await wrapper.find('form').trigger('submit')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('allows typing the same username in both fields but rejects submitting it', async () => {
    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'alice')

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Usernames must be different')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('requests the intersection and renders matches on success', async () => {
    global.fetch.mockReturnValue(jsonResponse([
      { title: 'Anora', url: 'https://letterboxd.com/film/anora/' }
    ]))

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith('/api/intersect?user1=alice&user2=bob')
    expect(wrapper.text()).toContain('Anora')
    expect(wrapper.find('a').attributes('href')).toBe('https://letterboxd.com/film/anora/')
  })

  it('shows the server error message when a watchlist is inaccessible', async () => {
    global.fetch.mockReturnValue(jsonResponse({ error: 'Watchlist inaccessible for: bob' }, false))

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Watchlist inaccessible for: bob')
  })

  it('shows a no-matches message when the intersection is empty', async () => {
    global.fetch.mockReturnValue(jsonResponse([]))

    const wrapper = mount(App)
    await setUsernames(wrapper, 'alice', 'bob')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No films in common.')
  })
})
