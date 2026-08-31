# Architecture

## Status

This document describes the approved target architecture for the MVP. The application shell, quality foundation, event domain, exact log parser, per-VOD event search and navigation, project schema, IndexedDB repository, project management, local source import, native playback, per-VOD synchronization, synchronized timelines, shared-time perspective switching, and basic clip editing exist; remaining domain features and adapters are implemented incrementally by milestone.

## Architectural style

BDO VOD Scanner is a client-only modular monolith. It has no backend, cloud database, account system, network API, queue, scheduler, or real-time server connection.

The architecture must remain reusable by a later Windows desktop shell without rewriting the domain model or main interface.

## Core principles

- All user data and processing remain local.
- Large VODs are accessed as files or streams and are never copied wholesale into memory or browser storage.
- Domain calculations stay independent of React and browser APIs where practical.
- Persistence, file access, media inspection, and export use explicit interfaces and adapters.
- Experimental media export is isolated from stable project, log, search, and timeline behavior.
- Expensive parsing and media operations must not block the UI thread.
- The simplest architecture satisfying the requirements is preferred.

## Feature boundaries

- Application shell and routing
- Project overview
- File import
- Exact log parsing
- Video metadata inspection
- Per-VOD synchronization
- Coordinated playback
- Video and event timelines
- Per-VOD search
- Clip editing and ordering
- Portable project import/export
- Experimental media export
- DaVinci Resolve export
- Local diagnostics
- Settings and internationalization

## Recommended source layout

```text
src/
  app/
    providers/
    routing/
    shell/
  domain/
    events/
    projects/
    synchronization/
    clips/
    time/
  features/
    project-overview/
    file-import/
    log-timeline/
    video-grid/
    video-sync/
    search/
    clip-editor/
    clip-export/
    davinci-export/
    diagnostics/
    settings/
  infrastructure/
    indexeddb/
    file-access/
    media/
    project-format/
    diagnostics/
  workers/
  shared/
    components/
    hooks/
    utilities/
    styles/
    types/
  i18n/
    locales/
  test/
    fixtures/
    helpers/
e2e/
docs/
```

## Time model

The log defines the shared session timeline. Every event receives a session-relative time in seconds and a unique ID independent of its timestamp.

Each VOD stores one synchronization anchor:

```text
videoTime = anchorVideoTime + (eventSessionTime - anchorEventSessionTime)
```

Multiple events may share one second and therefore initially map to the same video time. Every VOD has an independent anchor and offset.

The implemented synchronization workspace proposes the first valid event, supports searching and selecting another event, and records the paused video's fractional time. Its video timeline derives a bounded visible window from media duration, current center, and exponential zoom level; these calculations remain independent of React and browser APIs. Updating a sync point replaces only that VOD's anchor. Secondary anchors and drift correction remain intentionally unsupported.

Experimental Auto Sync is a suggestion layer in front of the same anchor operation. The crop selector produces normalized coordinates without persisting media pixels and maps pointer coordinates through the current image zoom and pan. A browser OCR adapter opens a second transient video element, samples only that rectangle around the current playhead, preprocesses it on a canvas, and sends it to one lazily created Tesseract.js Web Worker. Worker code, WebAssembly core variants, and English language data are copied from pinned npm packages into the static build, so recognition makes no runtime third-party request. Pure domain matching tolerates small OCR errors in names but requires attacker and victim agreement plus an exact visible chat hour and minute; a timestamp wrapped onto the immediately following line remains associated with its kill line. After a coarse hit, exponentially expanding backward probes find a frame where the line is absent; binary refinement then locates its first readable frame to within one tenth of a second. This remains accurate when a message stays visible in chat for several minutes. The result updates only the transient selected event and playhead until the user confirms the existing synchronization action.

Event import uses one boundary parser with strict format discrimination. Text logs accept the canonical GuildYapper participant layout, including the `has killed` variant, and derive a validated session date from ISO or `DD.MM.YYYY` filename fragments. Ikusa imports require `format: "ikusa-raw-session"`, version 4, a five-name array, a valid clock time, and a boolean kill flag for every accepted entry. Invalid entries become parse warnings; an empty or incompatible source is rejected. Raw source content is embedded unchanged for portable re-parsing, while synthesized in-memory events share the same domain model.

If the log clock crosses from late night to an earlier time, increment the day offset. A second synchronization point and drift correction remain future work.

## Playback coordination

The implemented coordinator derives shared session time from the main VOD's current media time and synchronization anchor. Each visible synchronized miniplayer maps that session time through its own anchor and follows the main play/pause intent. Only the main video is audible. Promoting a miniplayer maps the shared time into the new main VOD before switching.

The synchronization workspace mounts only the active perspective. Switching tabs maps the current synchronized session time into the newly active VOD and replaces the player source. Inactive perspectives do not keep an object URL, player, or decoder. Clip ranges remain attached to their source VOD.

## Timeline rendering

The main synchronization timeline uses a native range control for accessible dragging and keyboard operation. Wheel zoom and middle-button panning update only the timeline time window. The video viewport stores separate image scale and translation values, with pointer-centered wheel zoom and bounded image panning. Both surfaces provide visible controls and double-click reset behavior.

The clipping timeline adds a second, compact full-duration navigator backed by a bounded ten-frame filmstrip. Its highlighted window is derived from the same timeline-window state as the zoomed scrubber. Pointer dragging and keyboard movement update the window center and seek the paused playhead to that center while preserving the current zoom level; no full VOD is buffered or persisted.

The log-event track maps session times through the stored VOD anchor onto the same visible video-time window. Before synchronization, the selected event and current video position provide a provisional preview anchor. At most 48 marker bins are rendered: individual kills and deaths retain their semantic colors, while multiple events in one bin become a neutral bundle that zooms into its region. The searchable event list remains the complete semantic keyboard-operable representation.

Each VOD persists up to 50 independent search terms. Matching uses case-insensitive partial OR semantics across all supported name fields. Previous/next navigation preserves source order, including distinct events with equal timestamps. Once the active VOD is synchronized, event selection maps the event session time into the main VOD, pauses playback, and lets visible synchronized miniplayers follow the resulting shared session time. Events outside the active VOD's known source range are excluded from jump navigation.

## Clip editing

Clip creation, range validation, title updates, deletion, ordering, and clip-panel state are immutable domain operations validated through the portable project schema. The active player owns only the transient draft range. Saving snapshots the active VOD's search terms and the IDs of matching events whose mapped video times fall inside the inclusive range. Both timeline range handles use the same visible video-time window and estimated frame step as the playhead. The persistent clip panel follows `clipOrder`; drag-and-drop and accessible move buttons update that order and every clip's numeric order together.

## State and persistence

- Zustand is the approved state-management family.
- Store multiple named projects in IndexedDB through a repository abstraction.
- The implemented IndexedDB database is `bdo-vod-scanner`, with a versioned `projects` object store keyed by project ID.
- Keep transient playback updates from causing unnecessary application-wide React renders.
- Store portable domain data separately from browser-only runtime objects.
- Do not depend on persisted browser file handles for portable project recovery.
- Version local storage and portable formats independently where needed, with explicit migrations.

Project data is validated with the same strict schema before storage and after retrieval. The UI accesses storage through a repository interface; tests can substitute an in-memory repository without changing feature code.

VOD `File` objects are intentionally held only in transient Zustand state. Portable and IndexedDB project data contains metadata references, not media bytes. After reloading, selecting a file with matching name, size, and last-modified time relinks it to the existing VOD reference after its MP4 signature is checked.

Native HTML media inspection uses a short-lived object URL and stores duration and resolution when the browser can decode the metadata. The URL is always revoked. Failure to decode metadata preserves the VOD reference with unknown media fields and does not invalidate other imported sources.

## Worker boundaries

Consider Web Workers for:

- Log parsing if it measurably benefits responsiveness
- MP4 inspection
- Sample/keyframe indexing
- Clip extraction/remuxing
- Large project serialization

Do not introduce a worker solely for architectural symmetry. Define typed messages and cancellation behavior for long-running work.

## Export adapters

### Direct clips

The browser exporter is experimental. It must stream or read targeted ranges, preserve source quality, align cuts to safe keyframes, report progress, support cancellation, and allow partial success.

The approved [browser clip-export spike](./CLIP_EXPORT_SPIKE.md) selected Mediabunny 1.55.4 for the isolated experimental exporter. The implementation uses encoded packet sinks and sources rather than Mediabunny's high-level non-default start trim, which currently forces transcoding. A worker copies verified keyframe-aligned video and matching audio packets in decode order, rebases their timestamps, and streams MP4 output directly to a user-approved writable file.

The output picker must be opened by the initiating user gesture. When direct writable-file access is unavailable or denied, the application disables large media export with an actionable explanation; it must not buffer a large fallback Blob. MP4Box.js remains a fallback candidate for focused MP4 diagnostics or recorder-compatibility problems.

### DaVinci Resolve

The implemented exporter converts clip-domain data into one FCPXML 1.10 timeline. It defaults to 60 FPS and the largest imported VOD resolution, includes source audio, preserves manual clip order, and places edits sequentially without gaps. Export calculations are pure domain logic with frame-rational time values; the browser adapter only saves the generated XML file.

Browser exports deliberately reference source filenames without private full paths. Manual relinking is therefore the reliable workflow. A future desktop adapter may add approved full-path references after a privacy warning.

## Desktop evolution

The future Windows application should reuse the domain, features, state rules, project schema, and most UI code. Desktop-specific adapters may provide full paths, offline operation, FFmpeg integration, stronger relinking, and broader codec support.
