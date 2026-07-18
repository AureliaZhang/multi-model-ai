# Multi-Model AI Integration Platform

Personal multi-model chat + group AI + Arena eval, with station failover and a memory store.

> **Authoritative design/progress doc:** [`framework.md`](./framework.md)  
> Never delete framework content — only comment superseded version headers with `<!-- ... -->`.

## Stack

| Layer | Tech |
|-------|------|
| Client | Vite + React + TypeScript + Tailwind + Zustand |
| Server | Express + better-sqlite3 + `ws` (group rooms) |
| Tests | Vitest (server + client pure utils) |

## Quick start

```bash
# Server (default :3001)
cd server
npm install
npm run dev

# Client (Vite, proxies /api and /ws)
cd client
npm install
npm run dev
```

Optional env:

| Variable | Where | Purpose |
|----------|-------|---------|
| `DB_PATH` | server | SQLite file (default `server/data/app.db`) |
| `MIMO_API_KEY` / `MIMO_BASE_URL` | server | Optional seed of a default station (no hardcoded keys) |
| `HEALTH_CHECK_INTERVAL_MS` | server | Background station health sweep |
| `ARENA_CONCURRENCY` | server | Parallelism for Arena/benchmarks (1–16) |
| `JWT_SECRET` | server | Auth signing secret (set in production) |

Default admin is seeded on first boot (see `server/src/database.ts` — change password after install).

## Scripts

```bash
# Server
cd server && npm run dev          # tsx watch
cd server && npm test             # vitest (node)
cd server && npx tsc --noEmit

# Client
cd client && npm run dev
cd client && npm test             # vitest pure utils
cd client && npm run build
```

## Layout

```
multi-model-ai/
  framework.md          # product + roadmap + change log (source of truth)
  client/               # SPA
  server/
    src/
      dbRows.ts         # SQLite row shapes (snake_case / SQL aliases)
      routes/           # Express routers
      services/         # invocation, occupancy, embeddings, rooms hub, …
      utils/            # errors, asyncPool, csv
```

## Development notes

- **Scope:** keep product work inside this directory unless you intentionally integrate the personal site.
- **P2 quality:** SQLite row `as any` is zeroed on routes/services; pure unit tests cover load-balancer, normalize, occupancy FSM, embeddings, **invokeModel failover** (injectable deps), vectorSearch (in-memory SQLite), client markdown/errors.
- **Git remotes:** private backup remote is separate from any public mirror; do not push secrets or rotate keys carelessly (history may still contain old values until rewritten).

## License / status

Personal project; not published as a general-purpose product. See `framework.md` §10.7 for remaining backlog and §12 for the full change log.
