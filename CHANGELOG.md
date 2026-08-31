# Changelog

All notable user-facing changes to BDO VOD Scanner will be documented in this file.

The project intends to follow Semantic Versioning once releases begin.

## [Unreleased]

### Added

- Added an experimental privacy-first Auto Sync workflow with a user-defined chat crop, bounded local OCR sampling, fuzzy kill-line matching, refinement to the first visible matched kill, progress, cancellation, and a confirmable anchor suggestion.
- Bundled the OCR worker, WebAssembly core, and English language data locally so recordings and chat crops never require a third-party service.
- Added GuildYapper `has killed` logs with descriptive dates, validated Ikusa raw-session JSON v4 imports, an in-app GuildYapper download guide, and editable VOD display names.

### Fixed

- Auto Sync now finds when the matched chat message first appears instead of anchoring to an older frame where a long-lived message is merely still visible.
- Auto Sync now requires the visible chat timestamp to match the log event and preserves image zoom while selecting the chat area.
- Every secondary VOD in clipping split screen now supports independent wheel zoom, middle-button pan, and double-click reset.
- Successful Auto Sync scans now seek the player immediately and guide the user through final frame-by-frame notification alignment.

## [0.1.1] - 2026-08-31

### Added

- Added privacy-safe contribution, security-reporting, bug-report, and feature-request guidance for the public repository.
- Added a local thumbnail filmstrip to the clipping playhead and clearer start, end, and save controls.
- Added automatic editable clip drafts spanning ten seconds before and after a selected timeline event.
- Added an optional clipping split screen for every synchronized, locally linked perspective.
- Added individual speaker controls for every perspective in clipping split-screen mode.

### Fixed

- Fixed the GitHub Pages header symbol path and made kill-streak markers seek to the first kill in the series.
- Replaced the easily missed browser confirmation with an explicit VOD deletion dialog.
- Extended automatic kill-streak clip drafts through ten seconds after the final combined kill.
- Reworked the project overview copy around the kill-streak clipping workflow.

## [0.1.0] - 2026-08-31

### Added

- Prepared the public AGPL-3.0-or-later release with a visible source link and an automated GitHub Pages deployment.
- Added an experimental worker-based, keyframe-aligned MP4 packet-copy exporter with source audio, direct-to-disk streaming, batch progress, cancellation, partial-failure handling, and collision-safe filenames.
- Added per-clip export selection and an **Export selected clips** action that preserves the saved manual clip order.
- Added persistent drag-and-drop clip ordering with accessible move-up and move-down controls.
- Added local FCPXML export for DaVinci Resolve with persisted frame-rate and resolution settings, source audio, manual clip order, and gapless edits.
- Added an in-app DaVinci Resolve import guide and one-click clip previews that stop at the saved out-point.
- Expanded the clipping workspace width and improved player height, event-lane density, marker targets, and differentiated clip handles.
- Added a persistent per-name split control that separates a selected-name timeline into dedicated kill and death lanes.
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
- Added shared-time perspective switching through the VOD tabs with one full-size active player.
- Kept inactive perspectives unmounted so they do not consume video decoding resources.
- Added persistent independent search-name filters for every VOD with case-insensitive OR matching.
- Added previous/next matching-event controls that seek and pause synchronized perspectives.
- Limited synchronized search results to events inside the active VOD's available source range.
- Added locally persisted clip creation with button and `I`/`O` keyboard in/out marking.
- Added draggable in/out handles, automatic search snapshots, matching-event counts, and editable clip titles.
- Added an accessible collapsible clip list with source perspective, range, duration, and deletion.
- Added a dedicated full-width clipping workspace opened from the synchronization panel.
- Added separate Kills and Deaths rows plus direct name entry that creates one independently filtered timeline per saved name.
- Separated temporary synchronization searches from persistent clipping-name timelines.
- Added confirmed per-VOD deletion from source cards and perspective tabs, including safe cleanup of owned clips and local file links.
- Made the clipping workspace hide project navigation, source import, and source cards until returning to synchronization.

### Documentation

- Specified desktop-only Explorer reveal buttons for successful clip exports and documented why the browser cannot safely provide the same operating-system action.
- Added the initial product requirements, architecture, workflow, security, media-support, and project-format documentation.
- Added the experimental browser clip-export spike comparing Mediabunny and MP4Box.js, with a recommended lossless packet-copy architecture, keyframe policy, streaming constraints, license impact, and prototype acceptance criteria.

### Fixed

- Made bundled timeline markers seekable and added zoom-independent 15-second kill-streak notifications to user-created clipping name timelines, styled after the Challenger, Invader, Slayer, and Conqueror in-game hierarchy.
- Consolidated each kill burst into one centered, staggered banner spanning its first through final kill, enlarged its title for unclipped readability, and moved video controls into a dedicated bar outside the picture.
- Made overlapping streak banners collapse responsively into tier-labelled diamond emblems and expand again when timeline zoom creates enough room.
- Added upper breathing room to selected-name timelines so expanded and collapsed streak diamonds are never clipped.
- Rate-limited held-arrow frame stepping so large local recordings do not accumulate expensive seek requests and freeze the player.
- Made playback, frame stepping, and clipping shortcuts work without focusing the video first while preserving normal typing inside text-entry controls.
- Previewed the active clip in/out frame in the player while dragging a range handle, then restored the normal timeline cursor when the handle was released.
- Preserved AV1/AAC recorder audio that begins slightly before a safe video keyframe by rebasing the clip to the earliest copied packet instead of producing a rejected negative timestamp.
- Reported the complete effective MP4 range when the final lossless AAC packet extends a few milliseconds beyond the safe video boundary.
- Prevented locally exported media files from triggering a development-server page reload that discarded the active project and session-only VOD links.
- Made direct clip export show folder selection, MP4 analysis, preparation, and writing progress instead of appearing idle during long keyframe scans, with actionable Chrome/Edge guidance when Brave or an embedded browser lacks writable-folder access.
- Aligned the clipping playhead track and every event lane to the same horizontal time scale.
- Corrected clip handles so both use the same visible timeline scale at every zoom level.
- Prevented mouse-wheel zoom over the video or timeline from scrolling the surrounding page.
- Kept the timeline time beneath the mouse pointer stationary while zooming at off-center positions.
- Kept synchronized and sync-required status colors stable when selecting another perspective.
