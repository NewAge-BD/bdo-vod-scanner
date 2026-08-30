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
- Added drag-and-drop and file-picker import for one dated BDO log and multiple MP4 perspectives.
- Added MP4 content-signature checks, native duration/resolution inspection, and partial-failure handling.
- Added local source cards with log event counts, parse warnings, VOD metadata, sync state, and relink state.
- Added session-only VOD file links and safe metadata-based relinking after a browser reload.
- Added overload warnings for projects with more than eight VOD references.
- Added the supplied character artwork as a privacy-safe website/header icon without HUD names.
- Added native local VOD playback with automatic object-URL cleanup.
- Added approximate previous/next-frame navigation using detected FPS or a 60 FPS fallback.
- Added a draggable video playhead with an exponentially zoomable and pannable visible time range.
- Added mouse-wheel zoom, middle-button panning, and double-click reset for both the video image and timeline time window.
- Added lightweight custom playback, mute, view-reset, and fullscreen controls so video-image zoom never displaces its controls.
- Added a shared log-event track on the visible video-time scale with green kills, red deaths, neutral dense-event bundles, and marker navigation.
- Added searchable log-event selection and one persistent synchronization anchor per VOD.
- Added independent sync status and calculated offset display for every perspective.
- Added synchronized multi-perspective playback with one audible main VOD and muted secondary miniplayers.
- Added perspective promotion that preserves shared session time, plus per-perspective show and hide controls.
- Added placeholders for unsynchronized, unlinked, and out-of-range perspectives without decoding hidden video.
- Added a dismissible performance warning when more than four perspectives are visible.
- Added persistent independent search-name filters for every VOD with case-insensitive OR matching.
- Added previous/next matching-event controls that seek and pause synchronized perspectives.
- Limited synchronized search results to events inside the active VOD's available source range.
- Added locally persisted clip creation with button and `I`/`O` keyboard in/out marking.
- Added draggable in/out handles, automatic search snapshots, matching-event counts, and editable clip titles.
- Added an accessible collapsible clip list with source perspective, range, duration, and deletion.
- Added a dedicated full-width clipping workspace opened from the synchronization panel.
- Added one source row per VOD plus separate Kills, Deaths, and Selected names event rows to the clipping timeline.
- Added confirmed per-VOD deletion from source cards and perspective tabs, including safe cleanup of owned clips and local file links.

### Documentation

- Added the initial product requirements, architecture, workflow, security, media-support, and project-format documentation.

### Fixed

- Prevented mouse-wheel zoom over the video or timeline from scrolling the surrounding page.
- Kept synchronized and sync-required status colors stable when selecting another perspective.

## [0.1.0] - Planned

- Initial public MVP. This release has not been implemented or published.
