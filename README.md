# Family tree

Build a family tree in the browser. Start with one person, then add parents, a partner, and children. Click anyone to follow ancestors and descendants. If the same person was entered twice, merge those records into one.

Without an account, this browser keeps one tree. Sign in to keep up to five trees and to create a view-only share link. You can turn that link off or replace it, and the old address stops opening the tree. People marked alive appear as Living on that link, without their photo, dates, places, or note.

You can also export JSON, GEDCOM, a picture, a diagram PDF, or a written ancestor and descendant report, and import JSON or GEDCOM.

## Run with Docker

Requires Docker.

```bash
make up
```

The site is at [http://localhost:3000](http://localhost:3000). Postgres for this stack listens on port 5434.

```bash
make logs     # follow container logs
make down     # stop the app and Postgres
make build    # build the app image only
```

`make` lists every target.

## Run locally

Requires Node.js and Postgres.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.example` points at Postgres on `127.0.0.1:5433` with user, password, and database `familytree`. The dev server prints its URL, usually [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```
