# Changelog

All notable user-facing changes to BDO VOD Scanner will be documented in this file.

The project intends to follow Semantic Versioning once releases begin.

## [Unreleased]

### Added

- Added the React, strict TypeScript, Vite, internationalization, and custom-CSS application foundation.
- Added the initial accessible project-overview shell.
- Added formatting, linting, type checking, unit testing, Chromium smoke testing, production builds, and private CI checks.
- Added the immutable BDO event model and exact `killed`/`died to` log parser.
- Added midnight rollover, duplicate-timestamp, invalid-line, and ordering handling.
- Added case-insensitive partial OR search across family, character, and guild names.
- Added a synthetic BDO log fixture and comprehensive parser/search tests.
- Added multiple named local projects backed by IndexedDB.
- Added project creation, opening, renaming, confirmed deletion, and reload recovery.
- Added schema-versioned `.bdo-vod-project.json` import and export with strict validation.
- Added browser coverage for the complete local project-management workflow.

### Documentation

- Added the initial product requirements, architecture, workflow, security, media-support, and project-format documentation.

## [0.1.0] - Planned

- Initial public MVP. This release has not been implemented or published.
