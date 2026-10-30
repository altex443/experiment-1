# Rep

A phone-friendly Qwik workout tracker with username/password registration, cookie-based login, and MongoDB storage. Each user has private workouts, exercises, history, goals, backups, and unfinished workouts. No external sign-in provider is required.

## Run locally

Requires Node 22 and a reachable MongoDB instance.

```sh
nvm use
npm install
# For a NEW setup only; preserve your existing .env:
cp .env.example .env
```

Configure server-only values in the ignored `.env`:

```text
MONGODB_URI=your-private-mongodb-connection-string
MONGODB_DB=rep
SESSION_SECRET=a-random-secret-at-least-32-characters
COOKIE_SECURE=false
COOKIE_SAME_SITE=Lax
```

Generate `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Existing values need not change. Old provider settings and `APP_USERNAME`/`APP_PASSWORD` are no longer used: create accounts through the registration page instead.

```sh
npm run dev         # API + frontend at http://localhost:5173
npm run build       # Type-check and build frontend
npm start           # Built frontend + API at http://localhost:3001
npm start -- --host 0.0.0.0 --port 8080
npm run dev:client  # Frontend only; requires a running backend
npm run preview    # Static preview; requires a configured API URL
npm test
```

Select **New here? Create an account**, choose a username and password, and confirm the password. Registration signs you in automatically. Usernames are case-insensitive, 3–32 characters, and allow letters, digits, dots, underscores, and hyphens; the first character must be a letter or digit. Passwords must contain 12–128 characters. Use a password manager: password recovery is not yet implemented.

Returning users select **Sign in**. The HttpOnly cookie remembers the session for 30 days. Settings shows the signed-in account and provides **Sign out**.

## Body-weight tracking

Open **Progress → Body weight** to record a measurement in kilograms with a date. Saving another value for the same date updates that day’s entry. The summary shows your latest measurement and the change since your first recorded date. Use **Edit** or **Delete** in the history to correct entries.

Measurements are private to your account, persist in MongoDB, and are included in exported JSON backups. Older accounts without body-weight history remain supported. Body weight does not change the calculation of exercise training volume.

## Exercise muscle maps

The exercise library includes front/back SVG muscle diagrams for every exercise. Highlights follow the exercise’s selected muscle group, including custom exercises. Workout editing and active sessions provide expandable **Muscle map** sections; the create-exercise form previews the selected group. These are simplified group illustrations, not exercise-specific recruitment estimates.

## Exercise form videos

Every built-in exercise includes a short YouTube form tutorial. Use **Watch proper form** in the exercise library, workout editor, or active workout. The embedded player loads only after you request it, uses YouTube’s privacy-enhanced domain, and never autoplays. **Open on YouTube** is available if embedding or playback is blocked. Videos are linked/embedded from their original creators, not downloaded or rehosted.

Custom exercises accept an optional YouTube link during creation. **Add or change video** on any exercise card lets you attach a video to an existing custom exercise, replace a built-in demonstration, or remove a link. Changes persist privately in your MongoDB workspace, apply when training, and are included in exported data. Only validated HTTPS YouTube links are accepted; arbitrary embed HTML and third-party iframe URLs are rejected.

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

All analytics derive from the signed-in account’s MongoDB data. New measurements, sessions, edits, deletions, and browser-data migrations update the calculations automatically.

## Hosting and configuration

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

### GitHub Pages frontend

Pages still requires a separately hosted Node API:

1. Set MongoDB credentials and session secret on the backend host.
2. Set backend `ALLOWED_ORIGINS=https://YOUR_USERNAME.github.io`, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=None`.
3. Set GitHub Actions repository variable `VITE_API_URL=https://YOUR_BACKEND`.
4. Select **Settings → Pages → Source → GitHub Actions** and push to `main` or run **Deploy GitHub Pages**.
5. Open the site and create an account.

Some browsers block cross-site cookies despite these settings. Use the app served by the backend directly, or same-site custom domains, for those browsers.

## Authentication and data isolation

MongoDB’s `users` collection stores salted scrypt password hashes, never plaintext passwords. A unique index enforces normalized usernames for local accounts, including concurrent registrations. Login errors are generic. Registration/login attempts are limited per connection address per server process, and concurrent password hashing is bounded.

The `sessions` collection stores hashes of opaque random session IDs and expiry dates, with a TTL cleanup index. Cookie sessions are checked for expiry on every request. Logout revokes the current session; changing the stored password hash or session secret invalidates existing sessions. Passwords and session hashes are excluded from API responses and exported training backups.

All training reads and writes use the account ID derived from the authenticated session. Client-supplied account IDs cannot select another user’s data. MongoDB’s `training` collection stores one workspace per user with revision checks to prevent lost concurrent writes. The 16 MB document limit applies per workspace.

Old shared workspaces and old provider identities are preserved without being assigned to new accounts. There is no automatic account linking. Old shared workspaces require database administration to migrate; the app does not restore uploaded backup files.

## Backups and logs

Settings supports backup export and explicit migration of old browser data. Uploading or restoring backup files is not supported. Browser migration replaces only the signed-in user’s workspace after confirmation; export a backup first when useful server data already exists. The backup API is export-only.

JSON server logs include startup/database phases, request IDs, normalized routes, response status/timing, registration/login outcomes, conflicts, and shutdown. They exclude usernames, passwords, cookies, connection strings, bodies, query strings, and raw driver messages.

## Validation

`npm test` covers account registration/login, validation, duplicate and concurrent registrations, salted hashing, session persistence/expiry/revocation, secret rotation, rate limits, CORS, server-derived data ownership, user isolation, training operations, backups, and log redaction. `npm run build` checks TypeScript and bundles the client. Tests simulate MongoDB; live database and browser behavior require target-environment verification.
