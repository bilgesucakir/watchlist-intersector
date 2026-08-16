# watchlist-intersector

Spring Boot and Vue-based watchlist comparison tool for Jsoup-driven
Letterboxd scraping, cross-user intersection matching, and CSV list export.

Given two Letterboxd usernames, scrapes their public watchlist pages with
Jsoup and finds every film on both. The main flow ("What We'll Watch
Tonight") hands back a single random pick from the overlap — for when you
just want an answer, not a list to argue about — with the full comparison
still one click away, plus a CSV export ready to import into a new
Letterboxd list.

## Features

- **What We'll Watch Tonight** — the primary action: picks one random film
  from both watchlists' overlap and shows it front and center, with a
  poster from TMDB where one's found. Costs one poster lookup, not one per
  match, since only the picked film needs an image
- **Return all films in both watchlists** — a smaller secondary action for
  browsing the full overlap as a poster grid, sorted alphabetically, each
  linking to its Letterboxd page
- **Live username validation** — as you type, checks whether each username
  exists on Letterboxd and whether its watchlist is public, with both
  buttons staying disabled until both are ready, and shows the user's
  avatar once verified
- **CSV export** — from the full-list view, download the matches as
  `user1_user2_watchlist_intersection.csv`, formatted to import cleanly
  into a new Letterboxd list

## Configuration

Poster images are looked up from [TMDB](https://www.themoviedb.org/), which
requires a free API key (Settings → API on your TMDB account). Without it,
the app works exactly the same — matches just come back with no `posterUrl`.

For local development, copy `.env.example` to `.env` and fill in
`TMDB_API_KEY`:

```bash
cp .env.example .env
```

`.env` is loaded automatically (via [spring-dotenv](https://github.com/paulschwarz/spring-dotenv))
and gitignored, so it's picked up every time regardless of which terminal
session you're in — no manual `export` needed. In production (Render), set
`TMDB_API_KEY` as a real environment variable in the dashboard instead;
`.env` files are a local-dev convenience only.

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
  {
    "title": "The Outrun (2024)",
    "url": "https://letterboxd.com/film/the-outrun/",
    "year": 2024,
    "posterUrl": "https://image.tmdb.org/t/p/w342/abc123.jpg"
  }
]
```

`year` is parsed from the title (not the slug, which can carry a different
disambiguation year) and is `null` if it couldn't be determined. `posterUrl`
is `null` if `TMDB_API_KEY` isn't set or TMDB has no match.

Add `&random=true` to get a single random film from the overlap instead of
the full list — the response is still an array, just with 0 or 1 elements,
so the shape stays consistent either way. Only that one film gets a poster
lookup, not the whole overlap, since the rest are never returned. There's
no exclude/no-repeat parameter — every call (including "pick again") is an
independent, genuinely random draw from the full overlap, so it can
occasionally repeat the previous pick.

Returns `400` with `{ "error": "..." }` if either watchlist is private or
the username doesn't exist.

### `GET /api/users/{username}/exists`

Cheap username check — fetches only the first watchlist page, without
walking pagination. Used by the frontend to validate a username as it's
typed, before enabling the submit button.

```json
{ "exists": true, "watchlistPublic": true, "avatarUrl": "https://a.ltrbxd.com/resized/avatar/upload/..." }
```

- `exists: false` — the username doesn't exist on Letterboxd
- `exists: true, watchlistPublic: false` — the user exists, but their
  watchlist isn't public (or is empty)
- `exists: true, watchlistPublic: true` — ready to use for intersection

`avatarUrl` is `null` if the profile has no avatar in the page markup.
