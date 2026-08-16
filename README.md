# watchlist-intersector

Spring Boot and Vue-based watchlist comparison tool for Jsoup-driven
Letterboxd scraping, cross-user intersection matching, and CSV list export.

Given two Letterboxd usernames, scrapes their public watchlist pages with
Jsoup, finds every film on both, links out to each match's Letterboxd page,
and lets you export the results as a CSV ready to import into a new
Letterboxd list.

## Features

- **Live username validation** — as you type, checks whether each username
  exists on Letterboxd and whether its watchlist is public, with the submit
  button staying disabled until both are ready
- **Watchlist intersection** — finds every film on both watchlists, sorted
  alphabetically, each linking to its Letterboxd page
- **CSV export** — download the matches as `user1_user2_watchlist_intersection.csv`,
  formatted to import cleanly into a new Letterboxd list

## Run

```bash
mvn spring-boot:run
```

This builds the Vue frontend into `src/main/resources/static` first, then
serves everything (API + UI) from `http://localhost:8080`.

## Develop

Backend only:

```bash
mvn spring-boot:run -Dskip.frontend.build=true
```

Frontend with hot reload (proxies `/api` to the backend on 8080):

```bash
cd frontend
npm install
npm run dev
```

## Test

```bash
mvn test
```

Runs both the backend suite (JUnit + Mockito) and the frontend suite
(Vitest + Vue Test Utils). Skip the frontend half with
`-Dskip.frontend.build=true`, or run it on its own:

```bash
cd frontend
npm test
```

## API

### `GET /api/intersect?user1={username}&user2={username}`

Returns `200` with a JSON array of matches, sorted alphabetically by title:

```json
[
  { "title": "The Outrun (2024)", "url": "https://letterboxd.com/film/the-outrun/", "year": 2024 }
]
```

`year` is parsed from the title (not the slug, which can carry a different
disambiguation year) and is `null` if it couldn't be determined.

Returns `400` with `{ "error": "..." }` if either watchlist is private or
the username doesn't exist.

### `GET /api/users/{username}/exists`

Cheap username check — fetches only the first watchlist page, without
walking pagination. Used by the frontend to validate a username as it's
typed, before enabling the submit button.

```json
{ "exists": true, "watchlistPublic": true }
```

- `exists: false` — the username doesn't exist on Letterboxd
- `exists: true, watchlistPublic: false` — the user exists, but their
  watchlist isn't public (or is empty)
- `exists: true, watchlistPublic: true` — ready to use for intersection
