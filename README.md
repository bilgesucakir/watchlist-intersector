# watchlist-intersector

Given two Letterboxd usernames, finds the films on both users' public
watchlists and links out to each match's Letterboxd film page.

No official Letterboxd API is used (they don't grant access for personal
projects) — this scrapes the public watchlist HTML pages with Jsoup.

## Run

```
mvn spring-boot:run
```

This builds the Vue frontend into `src/main/resources/static` first, then
serves everything (API + UI) from `http://localhost:8080`.

## Develop

Backend only:

```
mvn spring-boot:run -Dskip.frontend.build=true
```

Frontend with hot reload (proxies `/api` to the backend on 8080):

```
cd frontend
npm install
npm run dev
```

## Test

Backend (JUnit + Mockito):

```
mvn test
```

Frontend (Vitest + Vue Test Utils):

```
cd frontend
npm test
```

## API

```
GET /api/intersect?user1={username}&user2={username}
```

Returns `200` with a JSON array of `{ title, url }` on success, or `400`
with `{ error }` if either watchlist is private or the username doesn't
exist.
