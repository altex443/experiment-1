# Forma

A responsive gym training app with a **Qwik + TypeScript client** and a **Node.js HTTP server**. “Quick” is interpreted as Qwik.

## Run locally

Requires Node.js 22 or newer.

```sh
nvm install
nvm use
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the Node server on port 3001.

```sh
npm run build   # Type-check and build the client
npm run build:watch # Watch TypeScript and rebuild the client into dist/ on changes
npm start       # Serve the built app and API at http://localhost:3001
npm test        # Run Node API integration tests; no dependencies required
```

## Server configuration

Pass options through the start script after `--`:

```sh
npm start -- --host 0.0.0.0 --port 8080 --data-file /var/data/training.json
npm start -- --help
```

Equivalent environment configuration:

```sh
HOST=0.0.0.0 PORT=8080 DATA_FILE=/var/data/training.json npm start
```

Options override environment variables. Defaults are `127.0.0.1`, port `3001`, and the project’s `data/training.json`. Relative data paths resolve from the working directory. Parent directories are created on first save.

For Render, use build command `npm ci --include=dev && npm run build` and start command `npm start -- --host 0.0.0.0 --data-file /var/data/training.json`. Leave `--port` unset so Render’s `PORT` is used. Mount a persistent disk at `/var/data` to preserve training records.

## Features

- Overview with weekly workouts, training volume, and completed sessions.
- Create, edit, and delete workout plans, including custom sets, reps/seconds, and weights.
- Searchable exercise library with muscle-group filters.
- Active workout with editable per-set reps and weights, elapsed time, and partial-session completion.
- Unfinished workouts automatically recover from browser storage after reload.
- Session details, deletion, and retry protection to prevent duplicate logs.
- Editable weekly training goal and a daily activity chart.
- Persistent session history and computed training volume.
- Responsive layouts, labeled controls, and loading/error/empty states.

## Organization

- `src/`: Qwik client and responsive styles.
- `server/app.js`: dependency-free Node API, validation, and static serving.
- `index.js`: server entry point.
- `test/`: integration tests using Node's built-in test runner.
- `data/training.json`: runtime data, created on first save and ignored by Git.

The API exposes `GET /api/state`, `POST /api/plans`, `PUT /api/plans/:id`, `DELETE /api/plans/:id`, `POST /api/sessions`, `DELETE /api/sessions/:id`, and `PUT /api/settings`. Session saves accept an optional `requestId` for safe retries. Writes are serialized and use atomic file replacement. Set `PORT` to change the API/production port; update the Vite proxy if changing it during development.

This is a single-user local application with no authentication. The server binds to loopback by default; use `--host 0.0.0.0` for hosting. Add authentication and a database before deploying for multiple users. Exercise defaults can be edited in plans and during sessions. Volume uses actual logged reps and weights; timed holds do not contribute to volume. Historical sessions retain their logged values when a plan changes or is deleted. Fonts use Google Fonts with local fallbacks.

## Validation

`npm run build` checks TypeScript and creates the production client. `npm test` exercises the real HTTP request handler with temporary storage, without opening a network port. Tests cover validation failures, plan lifecycle, custom logged volume, retry deduplication, settings, and durable history.
