# Forma

A Qwik gym trainer that runs entirely on GitHub Pages. Workouts, session history, and weekly goals are saved in your browser’s local storage. No backend, account, database, or paid hosting is required.

## Run locally

Requires Node.js 22 or newer for development and builds.

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open http://localhost:5173. Only the client runs; there is no API server to start.

```sh
npm test            # Storage lifecycle, validation, backup, and legacy config tests
npm run build       # Type-check and build static files into dist/
npm start           # Preview dist/ at http://localhost:4173
npm run build:watch # Rebuild dist/ on changes; run npm start separately to preview
```

## Deploy free on GitHub Pages

1. Create a **public** GitHub repository and push this project, including `package-lock.json` and `.github/workflows/deploy-pages.yml`, to its `main` branch.
2. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy GitHub Pages → Run workflow**, choose `main`, and run it. Subsequent pushes to `main` deploy automatically.
4. When the workflow succeeds, open the URL shown in its deployment or **Settings → Pages**. For a project repository, this is usually `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

The workflow tests and builds the app, derives the URL base path from Pages configuration, uploads `dist/`, and deploys it. There is no manual build upload, Render setup, server start command, or secret to configure. If your default branch differs from `main`, update the workflow’s branch filter.

For a local build that simulates a project subdirectory:

```sh
BASE_PATH=/forma/ npm run build
npm start -- --host 127.0.0.1
# Open http://localhost:4173/forma/
```

## Data and backups

Each visitor has their own workouts and history. Data persists across reloads and deployments at the same URL, but clearing site data or using another browser/device does not preserve it. Private browsing may discard data when closed. Different project paths have separate storage keys.

Open the profile/settings button, or **Progress → Change weekly goal**, to **Export backup** or **Restore backup**. Restore replaces the current browser’s training data after confirmation. Backups are JSON files. Existing Node server data is not uploaded to Pages; you can restore a copy of `data/training.json` through this interface.

## Features and structure

- Create, edit, and delete workout plans with custom sets, reps/seconds, and weights.
- Search and filter exercises; track actual set performance and elapsed workout time.
- Recover unfinished workouts after reload; save partial sessions without duplicate retry logs.
- View session details, delete sessions, and track weekly progress against a configurable goal.
- Export/restore validated backups and report unavailable/full browser storage.
- `src/app.tsx`: Qwik interface; `src/local-store.mjs`: browser persistence and validation.
- `src/training.ts`: browser storage integration and project-specific draft keys.
- `.github/workflows/deploy-pages.yml`: build and deployment workflow.
- `server/` and `index.js`: retained legacy Node implementation, unused by the Pages app and current npm startup scripts.

## Validation

`npm test` covers persistence across store recreation, plan/session lifecycle, actual training volume, retry deduplication, invalid operations, backup restore, per-project isolation, and storage errors. `npm run build` checks TypeScript and bundles the static client. Browser interaction and live Pages deployment must be verified in the target environment.
