# Privacy and Security

## Privacy model

BDO VOD Scanner is local-first:

- Logs and VODs are processed on the user's computer.
- Imported content is never uploaded.
- There is no account, backend, cloud storage, telemetry, analytics, or automatic crash reporting.
- Application resources are bundled; no third-party font, script, stylesheet, or CDN is loaded at runtime.
- The application makes no third-party network requests after loading.

## Sensitive information

Logs contain family names, character names, and guild names. Local paths may expose Windows usernames and directory structures. Treat all of these as sensitive even if some names are publicly visible in the game.

Do not commit real logs, names, full local paths, VODs, browser data, exports, or screenshots containing such data.

## Input security

Treat as untrusted:

- Logs
- Project files
- Filenames
- File metadata
- Imported titles and search terms
- Translation resources

Required controls:

- Strict schema validation for structured imports
- Bounded sizes and collection counts
- Text rendering without HTML interpretation
- Filename sanitization
- Safe handling of malformed or unsupported media
- Rejection of unknown newer project versions
- No dynamic code execution from imported content
- A restrictive Content Security Policy for the final static application

## Filesystem access

- Read only files explicitly selected or dropped by the user.
- Request output-directory access only from an explicit user action.
- Explain why write access is requested.
- Treat permission denial and cancellation as normal outcomes.
- Do not infer that a stored handle remains authorized.
- Never expose full paths in website-generated project or diagnostic files.
- A future desktop application must warn before exporting full paths.

## Local persistence

Store multiple named projects and non-sensitive UI preferences locally. Do not store VOD contents. Provide **Clear all local data** and require confirmation.

Use explicit local schema versions and non-destructive migrations. Ask before any potentially data-losing migration.

## Diagnostics

There is no automatic reporting. A user may explicitly export a diagnostic file containing only technical metadata such as:

- Browser and app version
- Codec information
- File size
- Error code
- Browser capability flags

Diagnostics must exclude:

- Family, character, and guild names
- Raw log lines
- Local paths
- Video or audio data
- Persistent tracking identifiers

Let the user inspect the diagnostic output before sharing it.

Application code must not use production console logging. Technical details should be presented through bounded, redacted in-app diagnostics when needed.

## Destructive actions

Confirm before:

- Deleting a project
- Discarding an unexported session
- Removing a VOD that owns clips
- Clearing all local data
- Applying a potentially destructive migration

## Hosting and access control

The repository remains private and the application remains local during development. Do not publish GitHub Pages until explicitly approved.

A client-side password prompt is not an authentication boundary and must not be implemented as protection. If a protected online preview is later required, evaluate a genuinely authenticated hosting solution after approval.

Before public release:

- Select an Open Source license.
- Review dependencies and licenses.
- Enable HTTPS.
- Verify deployment permissions and least-privilege GitHub Actions.
- Confirm that no real data or secret exists in repository history or build artifacts.
