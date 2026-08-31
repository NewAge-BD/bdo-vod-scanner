# Development Guide

## Intended environment

- Windows development is the primary environment.
- Node.js 24 LTS
- npm with a committed `package-lock.json`
- React 19.2
- TypeScript 6.0 in strict mode
- Vite 8.2

Stable compatible patch versions are locked in `package-lock.json`. TypeScript 6 is temporarily pinned because the approved React i18n integration does not yet declare TypeScript 7 compatibility. Upgrade after its peer range supports TypeScript 7 and all checks pass. Do not use prereleases without approval.

## Intended quality tools

- ESLint 10
- Prettier 3.9
- Vitest 4
- React Testing Library 16
- Playwright 1.62 using Chromium, Firefox, and WebKit

## Local setup

```text
npm install
npm run dev
```

The local URL is printed by Vite. No backend or external service is required.

## Commands

```text
npm run dev
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Playwright requires local browser binaries. Install them once with `npx playwright install chromium firefox webkit` when a smoke test reports that an executable is missing. Run a single engine with `npm run test:e2e:chromium`, `npm run test:e2e:firefox`, or `npm run test:e2e:webkit`.

## Required verification

Relevant changes must pass formatting, linting, type checking, affected unit/integration tests, Chromium, Firefox, and WebKit smoke tests for central workflows, and a production build.

Use a small synthetic log and a tiny synthetic MP4 fixture. Never add the supplied real log, real names, or large VODs to the repository.

## Dependency policy

Adding a dependency requires prior approval. Explain:

- Why it is needed
- Reasonable alternatives
- License
- Maintenance status
- Bundle-size impact
- Security and privacy implications

Compatible upgrades may be applied after verification. Major upgrades require approval.

## Git workflow

- `main` is the stable branch once Git is initialized.
- Larger work may use local feature branches.
- Use English Conventional Commits.
- Completed tasks are committed locally after successful checks.
- Pushing, publishing, releasing, or deploying always requires explicit approval.

## Deployment status

The public static application is deployed from `main` to GitHub Pages through `.github/workflows/pages.yml`. The workflow builds with the repository subpath and deploys only the generated `dist` directory. Imported logs, VODs, browser databases, and generated media are never part of the deployment artifact.
