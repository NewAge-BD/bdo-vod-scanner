# Contributing to BDO VOD Scanner

Thank you for helping improve BDO VOD Scanner. The project welcomes focused bug fixes, tests, documentation improvements, and proposals that fit the documented product scope.

## Before you start

- Read `docs/MASTER_PROMPT.md` for product requirements and scope.
- Read `docs/PRIVACY_AND_SECURITY.md` before sharing diagnostics, fixtures, or screenshots.
- Open an issue before starting a large feature, architecture change, breaking change, new dependency, desktop implementation, or AI event-recognition work.
- Keep changes small and avoid unrelated refactors.

## Protect private data

Never include real BDO logs, family names, character names, guild names, local paths, VODs, browser databases, exported clips, secrets, or screenshots containing such data.

Use synthetic names and the reviewed fixtures under `src/test/fixtures`. Reduce bugs to privacy-safe synthetic examples before posting them publicly. Technical diagnostics may contain browser and app versions, codecs, file sizes, error codes, and capability flags, but must not contain imported content or local paths.

## Development setup

The primary development environment is Windows with Node.js 24 LTS and npm.

```text
npm install
npm run dev
```

See `docs/DEVELOPMENT.md` for the complete setup and architecture documentation.

## Required checks

Run the checks relevant to your change before opening a pull request:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Add or update tests for behavior changes. Use English for code, identifiers, comments, technical documentation, issue content, and commit messages.

## Pull requests

- Use an English Conventional Commit title such as `fix: preserve clip order`.
- Explain the user-facing outcome and relevant limitations.
- Link the related issue when one exists.
- Confirm that no private or generated data is included.
- Document checks that could not be run and why.
- Preserve compatibility with released portable project formats.

By contributing, you agree that your contribution is licensed under AGPL-3.0-or-later, the same license as the project.
