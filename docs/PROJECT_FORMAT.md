# Portable Project Format

## Purpose

The portable BDO VOD Scanner project file preserves a work session without embedding large video content. The website and future Windows application must share the same versioned format.

The implemented portable file extension is `.bdo-vod-project.json`. Schema version `1` is the initial strict JSON format and is shared by browser persistence and portable exports.

## Compatibility rules

- Every file has an explicit schema version.
- Released older formats remain readable through tested migrations.
- Unknown newer versions are rejected safely with an update instruction.
- Never guess how to interpret unknown fields that affect timing or clips.
- Migrations must be deterministic and non-destructive.
- Potentially data-losing migrations require explicit approval.
- Validate imported values before using them.
- Reject an imported project when its project ID already exists locally, preventing silent replacement.

## Top-level project information

The format must contain:

- Project ID
- Schema version
- App version that wrote the file
- Project name
- Session date
- Creation and update timestamps
- Embedded raw log
- Parser version or sufficient derived event representation
- VOD references and metadata
- Synchronization anchors
- Per-VOD search terms
- Per-VOD split/merged state for selected-name timelines
- Clips and their manual order
- DaVinci defaults
- Relevant portable UI state

## Log data

The raw log is embedded because it is small and permits deterministic reparsing.

Every parsed event includes:

- Unique ID
- Original line number
- Raw line
- Clock time
- Day offset
- Session-relative time in seconds
- Verb: `killed` or `diedTo`
- Family A
- Family B
- Guild B
- Character A
- Character B

The portable format may omit a derived event index if it can be reproduced exactly from the embedded log and recorded parser version. Do not create two competing sources of truth.

## VOD references

Store metadata, never media bytes:

- Stable project-local VOD ID
- Display name
- Filename
- File size
- Last-modified timestamp when available
- Duration
- Width and height
- Frame-rate metadata
- Codec metadata
- Synchronization state and anchor
- Per-VOD search terms
- Names whose per-VOD timelines are split into separate kill and death lanes
- Optional desktop-only full path

Browser project files cannot rely on full local paths. When a project is reopened, ask the user to select matching VODs again and verify them using filename and metadata.

A future desktop export may include full paths only after a visible privacy warning.

## Synchronization anchor

Store:

- Event ID
- Event session time
- Matching video time
- Calculated offset
- An optional reserved structure for a future secondary anchor

Use numeric seconds with sufficient fractional precision. Do not persist formatted timestamps as the authoritative value.

Schema version 1 now writes this anchor when the user confirms synchronization. The stored offset is `videoTimeSeconds - eventSessionTimeSeconds`. Re-synchronizing a VOD replaces its anchor without changing other perspectives.

## Clips

Each clip contains:

- Unique ID
- Source VOD ID and identifying metadata
- User-editable title
- Source in-point and out-point
- Duration or enough information to derive it
- Snapshot of search terms active at creation
- Matching event IDs within the range
- Matching-event count
- Manual order
- Creation timestamp
- Export status only when useful for session continuation
- Last non-sensitive error code when useful

Changing the current VOD search must not modify existing clip snapshots.

## Excluded data

Never embed:

- Video or audio content
- Thumbnails large enough to materially grow the project file without a separately approved design
- Browser database files
- Secrets or credentials
- Telemetry identifiers
- Diagnostic logs containing imported names
- Full local paths in website-generated files

## Validation and limits

Define and test sensible bounds for strings, arrays, raw-log size, event count, VOD count, and clip count. Bounds protect the application from malformed files but must comfortably exceed expected BDO sessions.

Use Zod at the untrusted import boundary. Convert validated transport data into domain objects rather than using raw JSON throughout the application.

## Implemented schema version 1

New projects start with no log, VODs, or clips. They use parser version `1`, a 60 FPS DaVinci default, a 1920×1080 default resolution, and an expanded clip panel. The schema currently accepts at most:

- 120 characters for a project name
- 5,000,000 characters for the embedded raw log
- 500 VOD references
- 100,000 clips
- 50 search terms per VOD or clip snapshot

The importer distinguishes malformed JSON, invalid schema data, and projects written by a newer schema version. No migration is needed before a second schema version exists.
