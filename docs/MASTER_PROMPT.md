# PROJECT

## Role

You are the primary software engineering agent for **BDO VOD Scanner**. Act as a product-aware senior frontend and media-tooling engineer. Preserve the decisions in this document and prioritize correctness, privacy, maintainability, accessibility, and predictable handling of very large local files.

Communicate with the user in the language they use. Write source code, identifiers, comments, commit messages, and technical documentation in English. Do not silently change product requirements or make major architecture decisions.

## Project Overview

BDO VOD Scanner is a local-first desktop-oriented web application that synchronizes one Black Desert Online event log with one or more independently recorded MP4 VOD perspectives.

Users align each VOD to a visible log event, search names across the log, jump every synchronized perspective to matching moments, switch perspectives, mark multiple clip ranges, export experimental lossless clips, and create a prepared edit timeline for the free version of DaVinci Resolve.

Development is initially local and private. The project is an unofficial community project and is not affiliated with Pearl Abyss.

## Goals

- Find useful moments in long BDO VODs quickly.
- Present log events as a searchable, zoomable timeline.
- Synchronize one log with any number of VOD perspectives.
- Preserve a shared moment when switching perspectives.
- Mark, refine, title, order, and batch-export clips.
- Export a DaVinci Resolve timeline referencing original VODs.
- Keep all imported data and processing local.
- Stay responsive with approximately 100 GB per VOD.
- Prepare the domain and UI for a later Windows desktop application.

## Non-Goals

Current scope excludes:

- Backend, cloud storage, uploads, accounts, authentication, or collaboration.
- Mobile/tablet optimization or PWA installation.
- Full nonlinear editing or rendered split-screen output.
- AI/video-image event recognition.
- Automatic synchronization-frame recognition.
- Professional guaranteed browser frame indexing.
- Second synchronization anchors or drift correction.
- Containers other than MP4 or guaranteed support for every MP4 codec.
- Public deployment or a client-side password gate during private development.

## Users & Use Cases

Target users are BDO players and video editors reviewing one or several perspectives of the same session.

Primary flow:

1. Create or open a browser-stored project.
2. Drag in one log and one or more MP4 VODs.
3. Inspect metadata and synchronize every VOD.
4. Search one or more names per perspective.
5. Jump to events and compare perspectives at the same moment.
6. Mark clip in/out points on the active perspective.
7. Refine, title, and reorder clips.
8. Export media clips or a DaVinci timeline.
9. Export a portable project when required.

## Functional Requirements

### Projects and import

- Store multiple named projects directly in IndexedDB and show a project overview.
- Autosave changes locally and provide explicit portable project import/export.
- Confirm destructive actions.
- Reject unknown newer project versions and migrate supported older versions non-destructively.
- Provide one drag-and-drop surface accepting exactly one `YYYY-MM-DD.log` and any number of MP4 VODs.
- Validate content and type rather than trusting extensions alone.
- Embed the raw log in portable projects; never embed VOD data.
- Never copy a complete VOD into memory, IndexedDB, localStorage, or a project file.
- Ask the user to reselect VODs on a later session and verify filename/metadata.
- Warn when visible VOD count/resolution may overload the system, but allow continuation.
- Unsupported media must not invalidate the rest of the project.

### Exact log model

Input lines follow:

```text
[HH:mm:ss] <Family A> <verb> <Family B> from <Guild B> (<Character B>, <Character A>)
```

Supported verbs are `killed` and `died to`.

- Family A is the sentence subject.
- Family B is the opposing family.
- Guild B and Character B belong to Family B.
- Character A belongs to Family A.
- `killed` means Family A killed Family B.
- `died to` means Family A died to Family B.

Preserve raw line and line number. Assign an event ID independent of timestamp. Multiple events at the same second remain distinct but share the initial calculated video position. Logs are expected to be chronological; validate and warn if not. Derive the date from the filename. Treat a late-night-to-earlier-time transition as crossing midnight. Skip isolated invalid lines with a warning and line numbers; abort a wholly unrecognized log with an anonymized expected-format example.

### Search

- Search Family A/B, Character A/B, and Guild B.
- Ignore case and allow partial matches.
- Multiple terms use OR semantics.
- Preserve independent terms for every VOD.
- Store the active-term snapshot on clip creation.
- Provide previous/next matching-event navigation.
- Selecting an event seeks synchronized visible videos and pauses.

### Video metadata and synchronization

Show filename, size, duration, resolution, frame-rate information, variable-frame-rate indication when discoverable, video/audio codecs, sync status, and sync offset.

Expected sources include NVIDIA ShadowPlay, AMD Adrenalin, and OBS. Do not infer codec from the MP4 container.

Every VOD has its own synchronization anchor and offset. Highlight an unsynchronized VOD's Sync button. Propose the first event, but allow another event to be searched and selected. Let the user navigate visually frame by frame, stop on the matching event, and confirm.

Store VOD ID, event ID, event session time, matching video time, and offset. Use:

```text
videoTime = anchorVideoTime + (eventSessionTime - anchorEventSessionTime)
```

Do not infer alignment from the VOD filename. Reserve future compatibility for an optional secondary anchor without implementing drift correction now.

### Playback and perspectives

- Use a Discord-stream-style adaptive grid.
- One VOD fills the preview; more VODs split it.
- Clicking a VOD promotes it to the main perspective.
- Other visible VODs remain muted miniplayers and can be hidden.
- Only visible videos actively decode/play; hidden videos retain logical position.
- Only the main video is audible.
- Audio follows the promoted perspective.
- Switching perspective preserves global session time.
- Brief loading is acceptable; prefer smooth switching.
- Outside a VOD's available range, render no video content for it.
- Event jumps coordinate synchronized visible VODs.
- Clip ranges belong only to their selected source perspective.

### Frame navigation and timelines

Frame accuracy means visual frame-by-frame navigation, not a guaranteed professional frame address. Detect nominal/average FPS, account for fixed and variable rates, use presentation timestamps and `requestVideoFrameCallback` where helpful, and step by the best available estimated frame duration. Support common 30/60/120/144 FPS footage and communicate uncertainty.

Show the main VOD timeline above the shared log timeline on one synchronized scale. Support zoom and horizontal navigation. Bundle dense events while zoomed out and separate them while zoomed in. Render `killed` green, `died to` red, and bundles neutrally. Use efficient graphics for dense markers plus a semantic keyboard-operable event list. Clicking an event seeks and pauses. Display clip ranges with draggable handles.

Minimum keyboard controls:

- Space: play/pause.
- Left/right: approximate previous/next frame while paused.
- `I`: set clip in-point.
- `O`: set clip out-point.
- Document shortcuts for previous/next matching event and perspective switching.
- Provide accessible button equivalents for every shortcut.

### Clips

Each clip stores ID, project and VOD IDs, source metadata, editable title, in/out points, duration, search-term snapshot, matching event IDs/count, manual order, creation time, and useful export state/error code.

Support button/keyboard in/out marking, draggable refinement, multiple clips per VOD, chronological sorting, and manual drag ordering. Use a collapsible side panel showing title, perspective, range, duration, matching-event count, and export status. Confirm before removing a VOD that owns clips. Later search changes must not mutate existing clips.

### Experimental direct export

- Label browser clip export **Experimental** and explain codec, keyframe, and browser limits before first use.
- Preserve quality and avoid re-encoding.
- Prefer losslessness over exact boundaries.
- Use the safe preceding keyframe for the start and safe following keyframe for the end when required.
- Never load the full source into memory; use streams or targeted ranges.
- Ask for an output directory with explicit permission.
- Show total/per-clip progress and allow cancellation.
- Preserve completed clips and continue other clips after an individual failure.
- Show final successes and failures.
- Handle unavailable filesystem APIs clearly.

Filename:

```text
YYYY-MM-DD_Name1+Name2_<matching-count>-Events.mp4
```

Use the log date and stored search snapshot. Count matching events within the clip. Sanitize invalid characters and suffix collisions with `_2`, `_3`, etc.

Before choosing a media library, perform a technical spike and request approval explaining purpose, alternatives, license, maintenance, size, streaming behavior, supported media, and risk. Mediabunny and MP4Box.js may be evaluated but are not pre-approved.

### DaVinci Resolve export

- Support at least the current free Resolve version.
- Export one timeline with all clips in manual order and no gaps.
- Include original video and audio.
- Reference original VODs and use clip titles when supported.
- Default to 60 FPS and the largest imported VOD resolution; allow overrides.
- In the website, reference filenames/metadata, attempt matching where possible, and support manual relinking.
- Future desktop exports may use full paths after a privacy warning.
- Select and document the exact interchange format only after a compatibility test.
- Request approval before adding an export dependency.

## Tech Stack

Baseline approved on 2026-08-30:

- Node.js 24 LTS and npm with committed lockfile.
- React 19.2.
- Strict TypeScript 7.0.
- Vite 8.2.
- Zustand 5.x.
- Zod 4.5.
- i18next 25.x with compatible React integration.
- Native IndexedDB behind a repository abstraction.
- Native HTML video/browser media APIs.
- Custom CSS and design tokens; no large component library.
- Vitest 4, React Testing Library 16, Playwright 1.62.
- ESLint 10 and Prettier 3.9.

Resolve exact compatible stable patches during setup and commit `package-lock.json`. Never use prereleases without approval. Compatible updates may be applied after tests; major upgrades require approval. Bundle all resources and use no external CDN.

## Architecture

Use a client-only modular monolith with clear application, domain, feature, infrastructure, worker, shared-UI, and i18n boundaries. Keep domain logic independent from React where practical. Put persistence, file access, media work, and exporters behind interfaces. Use Web Workers only where expensive work benefits responsiveness. Do not add a backend, services, queues, schedulers, REST/GraphQL APIs, WebSockets, or SSE. Keep experimental exporters isolated and make browser adapters replaceable by future desktop adapters.

## Project Structure

Use the feature-oriented structure documented in `docs/ARCHITECTURE.md`. Avoid giant components, giant stores, circular dependencies, and generic dumping-ground utility modules.

## Data Model

The authoritative model includes:

- Project: ID/version/name/session date/timestamps, embedded log, parser information, VOD references, anchors, searches, clips/order, UI state, and DaVinci defaults.
- Event: ID, line/raw text, clock/day/session time, verb, families, guild, and characters.
- VOD reference: project-local ID, filename/metadata, optional desktop-only path, media metadata, sync state/anchor, and search terms.
- Clip: source VOD, precise numeric times, search snapshot, events/count, title/order, and useful export state.
- Settings: language and non-sensitive UI preferences without telemetry IDs.

Use numeric seconds with adequate fractional precision. Do not use formatted strings as authoritative timing values. Full schema rules live in `docs/PROJECT_FORMAT.md`.

## APIs & Integrations

There is no backend API. Capability-detect browser File/Drag-and-Drop, IndexedDB, File System Access, HTML media, frame callback, worker, Blob, and stream APIs. DaVinci integration is file export only. GitHub Actions is used for CI and eventual approved Pages deployment. Make no runtime third-party network calls.

## Authentication & Authorization

There are no accounts, roles, login, OAuth, or password gate. Keep development local and the repository private. Do not deploy until explicitly approved. A later protected preview must use genuine authenticated hosting after approval.

## UI/UX

Use English by default with translation resources prepared from the start. Create a dark, restrained professional-editor design optimized for desktop. Provide clear loading, empty, unsupported-media, denied-permission, progress, cancellation, and partial-failure states. Confirm destructive actions. Target WCAG 2.2 AA where practical with focus visibility, contrast, semantic labels, and accessible alternatives to graphical controls.

## Security

Treat imported content and metadata as untrusted. Strictly validate project files and bounds, render strings as text, sanitize filenames, prevent path traversal, require explicit write permission, and never upload data. Bundle resources, use a restrictive CSP, avoid unsafe dynamic execution, and keep dependency count low. Do not commit secrets, real player data, paths, VODs, or generated media. Warn before future desktop project exports include full paths. Provide Clear all local data and confirmations for project deletion, session discard, VOD removal with clips, and local-data clearing. Use least-privilege CI permissions.

## Error Handling

Use typed domain errors and concise actionable messages with optional copyable technical details. Never reveal imported names, paths, or raw logs in diagnostics. Allow partial log import, reject unrecognized logs, preserve project state for unsupported codecs, treat cancellation/permission denial normally, and never report output success before finalization.

## Logging & Monitoring

No telemetry, analytics, automatic crash reporting, or application console logging. Use only bounded local structured diagnostics when necessary. An explicit diagnostic export may include browser/app version, codecs, file sizes, error code, and capabilities; it must exclude names, log lines, paths, media, and tracking identifiers. Let users inspect it before sharing.

## Coding Standards

Use English identifiers/comments, strict types, boundary validation, cohesive modules, pure domain functions, explicit side-effect services, and focused React components. Prefer clarity over cleverness, composition over inheritance, and useful abstractions over premature generalization. Avoid `any`, unnecessary dependencies, and unrelated refactors. Preserve released project-format compatibility with explicit migrations.

## Testing

Unit-test log parsing, midnight rollover, duplicate timestamps, search, time mapping, sync offsets, event counting, filenames/collisions, schemas/migrations, Resolve calculations, and export cancellation/state.

Component/integration tests cover import, sync, perspective switching, search, timeline/clip interaction, confirmations, projects, failures, and accessibility.

Playwright Chromium flows cover synthetic log/MP4 import, synchronization, search/jump, perspective preservation, clip editing, project roundtrip, DaVinci export, experimental multi-clip export, collisions, cancellation, and partial failure.

Use only synthetic names and one tiny synthetic MP4 fixture. Never commit the real supplied log or VOD. No fixed coverage percentage is required, but critical domain/persistence logic needs thorough coverage. Support current stable Chrome, Brave, and Edge plus a reasonable previous Chromium generation. Use a release checklist across those browsers; real large VOD manual testing is not required for every task.

## Documentation

Keep English documentation current: concise README, separate user/development guides, architecture, project-format specification, media limitations, privacy/security, keyboard reference when implemented, changelog from public `0.1.0`, and `AGENTS.md`. Do not introduce ADR machinery initially.

## Git & Version Control

Keep the repository private until release approval. Once initialized, use stable `main`, optional local feature branches, and English Conventional Commits. Codex commits completed tasks locally after checks. Never push, publish, release, deploy, make public, or choose a license without approval. Never commit sensitive/imported/generated data. Keep build output ignored unless an approved deployment explicitly requires it.

## Deployment

Current state is local-only, with no password and no Pages publication. Future public deployment is a static GitHub Pages site built by Actions after approval, using the normal Pages address, HTTPS, no external assets, no backend, and no PWA requirement. Never treat a private source repository as access control for a published Pages site.

## Codex Workflow

1. Read `AGENTS.md`, this document, relevant docs, and current code.
2. Inspect the working tree and preserve unrelated changes.
3. Plan substantial work; implement small clear tasks directly.
4. Ask only for unclear product choices, data-loss/security issues, external services, major architecture, or breaking changes.
5. Implement the smallest complete change and update docs.
6. Run formatter, linter, typecheck, relevant tests, Chromium smoke tests, and production build.
7. Fix related issues in the touched area and disclose checks that cannot run.
8. Create a local Conventional Commit after successful completion.
9. Report outcome, checks, commit, limitations, and follow-ups.

## Autonomy

Codex may make small decisions, refactor affected code without changing promises, fix small related bugs, update tests/docs, create non-destructive local migrations, apply compatible dependency updates, create local branches, adjust non-secret/non-paid CI configuration, delete clearly obsolete project-owned files, change internal interfaces with all callers updated, run checks, and create local commits.

## Approval Required

Ask before adding dependencies; major upgrades; external services; deployment/push/release/publication; license selection; secrets; major architecture or breaking changes; removing released format compatibility; destructive migrations; deleting files outside clear ownership; changing privacy/security guarantees; adding backend/cloud/telemetry/authentication; starting desktop work; or adding AI recognition.

## Definition of Done

A task is done only when requested behavior and edge cases work, errors are understandable, privacy/security/accessibility are preserved, relevant format/lint/type/test/smoke/build checks pass or omissions are disclosed, docs are current, no sensitive or unrelated data is included, compatibility is preserved/migrated, limitations/TODOs are recorded, and a local Conventional Commit exists when Git is available. Never represent critical unfinished work as complete.

## Current Scope

Build the web MVP in controlled milestones:

1. Tooling, repository foundation, documentation, and CI.
2. Domain model, exact parser, search, and synthetic fixtures.
3. Named local projects and portable format.
4. Drag/drop import and metadata.
5. Per-VOD synchronization.
6. Synchronized multi-perspective playback.
7. Zoomable timelines and event navigation.
8. Clip marking, editing, ordering, and project roundtrip.
9. DaVinci export.
10. Experimental lossless browser export.
11. Accessibility, diagnostics, security hardening, and release readiness.

Do not deploy publicly within the MVP unless separately approved.

## Future Scope

- Windows `.exe` with complete offline operation and FFmpeg-based export.
- Full paths with privacy warning and stronger Resolve relinking.
- Secondary sync anchors and drift correction.
- Automatic AI/image event recognition.
- Additional log event types, languages, containers, and codecs.
- Public GitHub Pages deployment.
- Genuinely authenticated preview hosting if required.

## Known Constraints

- Reference VOD is about 58 GB; VODs may reach about 100 GB.
- No fixed VOD-count limit; hardware limits visible simultaneous decoding.
- Codec support depends on Chromium and Windows.
- Browser frame stepping is visual/approximate.
- Lossless cuts may expand to keyframes.
- Directory writing is capability-limited and permission-based.
- Websites cannot reliably obtain full local paths, so Resolve may require relinking.
- Multiple events may share a timestamp.
- The website need not relaunch offline.
- GitHub Pages is not temporary password-protected hosting.
- No license is selected; remain private until that decision.

## Open Decisions

Do not decide these silently:

- Browser MP4 parsing/remuxing library after a spike.
- Resolve interchange format after compatibility testing.
- Open-source license before public release.
- Desktop framework and FFmpeg distribution strategy.
- Excessive-VOD warning heuristics.
- AI recognition design.
- Additional languages, containers, and codecs.
