# Repository Guidelines

## Project Structure & Module Organization

This repository is an initial Node.js package named `exp1`. Currently, `package.json` is the only project file. It declares CommonJS modules and an `index.js` entry point, but that entry point has not yet been created. There are no source, test, or asset directories.

Keep the entry point at the repository root. As the project grows, place supporting modules in `src/`, automated tests in `test/`, and static resources in `assets/` when needed. Update this guide when the actual layout changes.

## Build, Test, and Development Commands

- `npm test`: currently prints `Error: no test specified` and exits with status 1. Replace this placeholder when adding automated tests.
- `node index.js`: runs the declared entry point once that file exists.
- `npm install`: installs dependencies when they are added to `package.json`. Commit the generated lockfile to keep installations reproducible.

No build, development-server, lint, or formatting scripts are currently configured. Add explicit npm scripts when introducing those workflows.

## Coding Style & Naming Conventions

Use CommonJS (`require` and `module.exports`) consistently with the package configuration. Follow the existing two-space indentation in `package.json`; use two spaces for new JavaScript files as well. Prefer `camelCase` for variables and functions, `PascalCase` for classes, and descriptive lowercase filenames such as `config-loader.js`.

No formatter or linter is configured. Keep changes internally consistent, and document any tooling added to the package scripts.

## Testing Guidelines

No testing framework or coverage threshold is established. When adding executable behavior, add corresponding tests under `test/` using names such as `config-loader.test.js`. Configure `npm test` to run the chosen suite and ensure it passes before submitting changes. Include relevant error paths alongside successful cases.

## Commit & Pull Request Guidelines

This checkout has no Git metadata, so existing commit conventions cannot be verified. Use concise, imperative commit subjects, such as `Add package entry point`, and keep each commit focused.

Pull requests should describe the change, its purpose, and validation performed. Link relevant issues and disclose missing tests or incomplete setup. Include screenshots only for changes with visible UI behavior.
