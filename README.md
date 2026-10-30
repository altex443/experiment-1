# Rep

A minimal, phone-friendly workout tracker with a GitHub Pages frontend, a Node.js API, and MongoDB sync. Registration, login, workouts, exercises, weight history, and progress stay available across devices through your account.

## Deploy GitHub Pages with MongoDB sync

The checked-in Pages workflow builds **server-connected mode**, not browser-only mode. GitHub hosts the frontend; a separately hosted Node API connects to MongoDB and handles authentication. Database credentials never go to GitHub Pages.

1. Deploy the Node API from this repository to a Node host. Build command: `npm ci --include=dev && npm run build`. Start command: `npm start -- --host 0.0.0.0`.
2. Set private values on that host: `MONGODB_URI`, `MONGODB_DB=rep`, and `SESSION_SECRET` (a random secret of at least 32 characters). Allow the backend host’s network access in MongoDB.
3. For your Pages frontend, set backend `ALLOWED_ORIGINS=https://alextiron.github.io`, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=None`. Do not include the repository path in the origin.
4. In GitHub **Settings → Secrets and variables → Actions → Variables**, create the public repository variable `VITE_API_URL` containing your backend origin, e.g. `https://your-api.onrender.com`. No `/api` suffix, credentials, query string, or trailing path.
5. Set **Settings → Pages → Source** to **GitHub Actions**. Push this project to `main`, or run **Actions → Deploy GitHub Pages → Run workflow**.
6. Open `https://alextiron.github.io/experiment-1/`, register or sign in, and your data is read from/written to MongoDB.

The workflow runs tests and `npm run build:pages:sync`, sets the repository asset path, and injects only the public backend URL. A missing/invalid API URL fails the build with setup instructions; it never silently switches to browser storage. Keep `.env` ignored and do not upload it.

Cross-site cookies can be blocked by some browsers, especially on phones. Use same-site custom domains for the Pages frontend and API, or the app served directly by the backend, if your browser blocks them. If using the backend’s app URL, include that origin in `ALLOWED_ORIGINS` too.

## Run locally

Requires Node 22 and MongoDB for synced mode. Preserve your existing `.env`; new setups can copy `.env.example` and set `MONGODB_URI` and `SESSION_SECRET`.

```sh
nvm use
npm ci
npm run dev         # API + frontend at http://localhost:5173
npm run build       # Build the client for the Node host
npm start           # API + built frontend at http://localhost:3001
npm test
```

To verify a connected Pages build locally (use your actual public backend URL):

```sh
VITE_API_URL=https://your-api.onrender.com BASE_PATH=/experiment-1/ npm run build:pages:sync
npm run preview
# Open http://localhost:4173/experiment-1/
# For authenticated preview, also allow that origin on the backend.
```

Create an account through **New here? Create an account**. Passwords require 12–128 characters; usernames are case-insensitive and 3–32 characters. Cookie sessions last 30 days. Server-connected mode does not save training data to local storage as a fallback.

Saved changes reach MongoDB immediately. The app also refreshes data when you return to its tab and every 60 seconds while visible and idle. Automatic refresh pauses during workouts and form editing so it cannot overwrite ongoing input. Unfinished workouts are recovered at login/reload, rather than replaced underneath an active session.

## Optional standalone browser mode

Standalone mode remains an explicit alternative with no login, MongoDB, or cross-device sync:

```sh
npm run dev:pages
npm run build:pages
npm run preview
```

For a project path use `BASE_PATH=/experiment-1/ npm run build:pages`. This mode stores data only in the current browser and clearly labels it on-device mode. It ignores the API URL. To deploy this alternative, change the workflow build step to `npm run build:pages` deliberately. The default checked-in workflow uses MongoDB sync.

## Body-weight tracking

Open **Progress → Body weight** to record a measurement in kilograms with a date. Saving another value for the same date updates that day’s entry. The summary shows your latest measurement and the change since your first recorded date. Use **Edit** or **Delete** in the history to correct entries.

Measurements persist privately in MongoDB in the default Pages sync mode, or in the browser in explicit standalone mode, and are included in exported JSON backups. Older accounts without body-weight history remain supported. Body weight does not change the calculation of exercise training volume.

## Exercise muscle maps

The exercise library includes front/back SVG muscle diagrams for every exercise. Highlights follow the exercise’s selected muscle group, including custom exercises. Workout editing and active sessions provide expandable **Muscle map** sections; the create-exercise form previews the selected group. These are simplified group illustrations, not exercise-specific recruitment estimates.

## Exercise form videos

Every built-in exercise includes a short YouTube form tutorial. Use **Watch proper form** in the exercise library, workout editor, or active workout. The embedded player loads only after you request it, uses YouTube’s privacy-enhanced domain, and never autoplays. **Open on YouTube** is available if embedding or playback is blocked. Videos are linked/embedded from their original creators, not downloaded or rehosted.

Custom exercises accept an optional YouTube link during creation. **Add or change video** on any exercise card lets you attach a video to an existing custom exercise, replace a built-in demonstration, or remove a link. Changes persist in the current storage mode, apply when training, and are included in exported data. Only validated HTTPS YouTube links are accepted; arbitrary embed HTML and third-party iframe URLs are rejected.

Default sources:

- [Deep barbell back squat — ScottHermanFitness](https://www.youtube.com/watch?v=SW_C1A-rejs)
- [Barbell bench press — ScottHermanFitness](https://www.youtube.com/watch?v=rT7DgCr-3pg)
- [Single-arm dumbbell row — ScottHermanFitness](https://www.youtube.com/watch?v=pYcpY20QaE8)
- [Dumbbell shoulder press — ScottHermanFitness](https://www.youtube.com/watch?v=qEwKCR5JCog)
- [Romanian deadlift — Max Euceda](https://www.youtube.com/watch?v=3VXmecChYYM)
- [Plank — ScottHermanFitness](https://www.youtube.com/watch?v=pSHjTRCQxIw)

These are general demonstrations; select movements and loads suited to your ability. Playback depends on the creator’s availability, embedding permissions, and the viewer’s network/browser restrictions.

## Analytics

**Today** includes current body weight with a shortcut to its log. **Progress** offers 28-day, 90-day, and one-year filters for training and body-weight analysis:

- Sessions and lifting volume compared with the immediately preceding period of the same length. Percentage changes are omitted when the previous volume is zero.
- A body-weight chart with calendar-day spacing and selectable readings. Missing days are not filled. Latest weight is labeled as an overall measurement; period change and averages use only measurements in the selected period.
- A seven-calendar-day average from available readings, training time, average session duration, sessions per week, and an activity grid (28 or the most recent 84 days, labeled separately).
- Distribution of logged sets by muscle group. Older sessions without detailed sets are identified rather than assigned invented categories.
- Exercise performance with best external load, lifting volume, and best load-to-body-weight ratio. Ratios use the most recent weight on or before each session, no more than 30 days old. Missing/stale readings produce no ratio. Best load and best ratio may come from different sets.

Active workouts, exercise library context, and saved session details also display relevant body-weight information. Editing or deleting a weight reading updates related analytics; no historical weight is guessed. Timed holds are excluded from lifting volume and weighted performance comparisons. Body weight is never automatically added to exercise load. No one-rep maximum or health outcome is estimated.

All analytics derive from the active workspace: the signed-in account’s MongoDB data in connected mode, or browser storage in explicit standalone mode. New measurements, sessions, edits, deletions, and browser-data migrations update the calculations automatically.

## Server-mode hosting and configuration

For reliable login on phones, serve the frontend and API together on your Node host over HTTPS. Build with `npm ci --include=dev && npm run build`; start with `npm start -- --host 0.0.0.0`.

- `MONGODB_URI`: private server-only connection string. `MONGODB_DB` defaults to `rep`.
- `SESSION_SECRET`: server-only random value, minimum 32 characters. Rotating it invalidates sessions. An existing server-side `API_TOKEN` can be used as a legacy fallback; no API token is sent by or requested from users.
- `COOKIE_SECURE=true`: use for production HTTPS (also enabled by `NODE_ENV=production`).
- `COOKIE_SAME_SITE`: `Lax` by default; cross-site deployments require `None` with secure cookies.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, without paths; development localhost origins are allowed by default.
- `HOST`, `PORT`: server binding, overridden by startup CLI options.
- `VITE_API_URL`: public backend URL; empty means same-origin. Vite proxies `/api` to port 3001 in development.
- `LOG_LEVEL`: `debug`, `info` (default), `warn`, `error`, or `silent`.

`.env` and `.env.*` are ignored; `.env.example` contains placeholders only. Do not put credentials or session secrets into source files, `VITE_*`, GitHub workflow YAML, or public build variables.

## Server-mode authentication and data isolation

MongoDB’s `users` collection stores salted scrypt password hashes, never plaintext passwords. A unique index enforces normalized usernames for local accounts, including concurrent registrations. Login errors are generic. Registration/login attempts are limited per connection address per server process, and concurrent password hashing is bounded.

The `sessions` collection stores hashes of opaque random session IDs and expiry dates, with a TTL cleanup index. Cookie sessions are checked for expiry on every request. Logout revokes the current session; changing the stored password hash or session secret invalidates existing sessions. Passwords and session hashes are excluded from API responses and exported training backups.

All training reads and writes use the account ID derived from the authenticated session. Client-supplied account IDs cannot select another user’s data. MongoDB’s `training` collection stores one workspace per user with revision checks to prevent lost concurrent writes. The 16 MB document limit applies per workspace.

Old shared workspaces and old provider identities are preserved without being assigned to new accounts. There is no automatic account linking. Old shared workspaces require database administration to migrate; the app does not restore uploaded backup files.

## Backups and logs

Settings supports backup export in both modes. Server mode also supports explicit migration of old browser data. Uploading or restoring backup files is not supported. Browser migration replaces only the signed-in user’s workspace after confirmation; export a backup first when useful server data already exists. The backup API is export-only.

JSON server logs include startup/database phases, request IDs, normalized routes, response status/timing, registration/login outcomes, conflicts, and shutdown. They exclude usernames, passwords, cookies, connection strings, bodies, query strings, and raw driver messages.

## Validation

`npm test` covers standalone browser persistence and draft recovery, disabled storage, repository isolation, and account registration/login, validation, duplicate and concurrent registrations, salted hashing, session persistence/expiry/revocation, secret rotation, rate limits, CORS, server-derived data ownership, user isolation, training operations, backups, and log redaction. `npm run build` checks TypeScript and bundles the client. Tests simulate MongoDB; live database and browser behavior require target-environment verification.

## Troubleshooting MongoDB connections

Run `nvm use`, then `npm run db:check` in your normal terminal. The command reads the ignored `.env`, connects and pings MongoDB, and prints a credential-safe diagnosis. Startup logs include the same hints. It does not change database contents.

- `dns_srv`: your DNS resolver cannot resolve Atlas SRV/TXT records. Check VPN, firewall, and DNS settings. Alternatively copy Atlas’s standard `mongodb://` connection string from its Connect dialog; do not invent shard hostnames or remove TLS options.
- `server_selection`: ensure your cluster is running and add your computer’s current public IP in Atlas **Network Access → IP Access List**. Your network must allow MongoDB traffic, normally TCP 27017.
- `connection_refused`: verify the URI/port and firewall. If the nested failure is IPv6-specific, set `MONGODB_IP_FAMILY=4` in `.env`. This does not fix SRV lookup failures.
- `authentication`: use the Atlas database user credentials, not the Atlas website login; percent-encode special characters in the URI password.
- `tls`: check system time, trusted certificates, and VPN/TLS inspection. Do not disable certificate validation.

Diagnostics report only recognized error fields and fixed hints; raw driver errors and connection strings remain hidden. The database user needs read/write access to create accounts, indexes, sessions, and workspaces.
