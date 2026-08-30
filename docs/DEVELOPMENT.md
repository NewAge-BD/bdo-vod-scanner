# Development Guide

> [!NOTE]
> The application toolchain has not been scaffolded yet. Commands in this guide become authoritative only after the initial setup task creates and verifies them.

## Intended environment

- Windows development is the primary environment.
- Node.js 24 LTS
- npm with a committed `package-lock.json`
- React 19.2
- TypeScript 7.0 in strict mode
- Vite 8.2

The initial setup must resolve and lock mutually compatible stable patch versions. Do not use prereleases without approval.

## Intended quality tools

- ESLint 10
- Prettier 3.9
- Vitest 4
- React Testing Library 16
- Playwright 1.62 using Chromium

## Intended commands

The initial scaffold should provide scripts equivalent to:

```text
npm run dev
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Document the exact command behavior after scaffolding.

## Required verification

Relevant changes must pass formatting, linting, type checking, affected unit/integration tests, Chromium smoke tests for central workflows, and a production build.

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

Development is local only. Do not configure an active public GitHub Pages deployment without explicit approval. A private repository does not make a published Pages site private.
