# Experimental Browser Clip Export Spike

## Status

Recommendation complete on 2026-08-30. No dependency has been installed and no exporter has been implemented. Adding the recommended library still requires explicit approval.

## Decision

Use **Mediabunny** for the first experimental browser exporter, subject to dependency approval and a successful synthetic-media prototype. Keep MP4Box.js as a fallback candidate for MP4 diagnostics if recorder compatibility problems appear.

The exporter must use Mediabunny's low-level encoded-packet APIs. Its convenient `Conversion` trimming API is not suitable for the lossless path because setting a non-default trim start currently forces video and audio transcoding.

## Required behavior

- Read one linked MP4 perspective at a time.
- Export every marked clip in the saved manual order.
- Preserve encoded video and audio packets without decoding or re-encoding.
- Prefer lossless output over exact user-selected boundaries.
- Move the effective start backward to a verified preceding video keyframe.
- Extend the effective end only when needed for a decodable packet range or audio/video consistency.
- Rebase output timestamps so each exported MP4 starts at zero.
- Stream directly to a user-selected file; never buffer a complete clip or source VOD in memory.
- Report per-clip progress, effective boundaries, cancellation, and errors.
- Keep successfully finished clips when a later export fails or the batch is cancelled.

## Candidate comparison

| Criterion              | Mediabunny                                                                                                 | MP4Box.js                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Primary fit            | Browser media reading, writing, conversion, and custom packet pipelines                                    | MP4 parsing, MSE segmentation, and sample extraction                                             |
| Lossless path          | Encoded packet sinks and encoded video/audio packet sources                                                | Sample extraction plus lower-level MP4 writing or fragmentation                                  |
| Keyframe support       | Locate, iterate, and optionally verify key packets                                                         | Seek to a previous random-access point and align segments or extraction to RAPs                  |
| Large-file output      | `StreamTarget` supports writable streams and propagates backpressure                                       | Caller must assemble a suitable streaming writer around lower-level output APIs                  |
| TypeScript integration | Written in TypeScript, tree-shakable, zero dependencies                                                    | ESM/CJS builds and TypeScript declarations, but a more manual pipeline                           |
| Scope                  | Supports MP4 now and leaves room for later container inspection                                            | Narrower MP4 specialization                                                                      |
| License                | MPL-2.0 weak copyleft                                                                                      | BSD-3-Clause                                                                                     |
| MVP risk               | Lower API and integration risk, but the lossless trim path still needs a custom packet-copy implementation | Higher implementation risk for a complete, ordinary playable trimmed MP4 with synchronized audio |

Mediabunny is preferred because it supplies both sides of the required pipeline: lazy packet reading and streaming MP4 writing. MP4Box.js has strong progressive parsing and sample extraction, but its documented segmentation workflow is primarily aimed at fragmented MSE output rather than the complete clip-export workflow required here.

## Proposed architecture

```text
saved Clip[] in clipOrder
        |
        v
export coordinator (main thread)
        |
        +-- obtain destination handle from the user's click
        +-- validate linked source and requested range
        |
        v
media export worker
        |
        +-- BlobSource(File) -> MP4 Input
        +-- inspect primary video/audio tracks
        +-- find and verify preceding video key packet
        +-- calculate effective packet interval
        +-- copy packets in decode order and rebase timestamps
        +-- MP4 Output -> StreamTarget(FileSystemWritableFileStream)
        |
        v
progress / completed / failed / cancelled result
```

The browser file picker must run directly from the export button's user gesture. Processing begins only after a destination handle has been granted. The worker owns media inspection and packet copying; React receives typed progress and result messages only.

## Boundary policy

For a requested range `[in, out]`:

1. Find the last verified video key packet whose presentation timestamp is less than or equal to `in`.
2. Use that packet's presentation time as `effectiveIn`.
3. Iterate video packets from that key packet in decode order.
4. Include audio packets required to cover the same effective media interval.
5. Use `out` when it produces a valid muxed result; otherwise extend to the first safe following boundary and disclose the adjustment.
6. Rebase all retained timestamps by the common effective origin while preserving relative audio/video timing.

The UI must show both the requested and effective range before or during export. It must never label an adjusted boundary as frame-exact.

Packets with B-frames require special care: presentation timestamps may be out of order even though packets must be supplied in decode order. The prototype must test this explicitly and must not sort encoded video packets by presentation time.

## Browser capability policy

The large-file path requires `showSaveFilePicker` and a writable file stream. Both availability and permission must be checked at runtime.

- Supported: stream output directly to the chosen destination.
- Missing or denied capability: disable experimental media export with an actionable explanation; DaVinci Resolve export remains available.
- Do not fall back to a whole-file `Blob` download for large clips because that can exhaust memory.
- Do not add a cloud service or third-party streaming relay.

The File System Access API is broadly available in Chromium, but Brave support can differ. Feature detection is therefore mandatory even though Brave is an MVP target.

## Failure and cancellation rules

- Cancellation stops the active packet pipeline and closes or aborts the writable stream safely.
- An unfinished destination is reported clearly; the application must not claim it as a completed clip.
- Completed earlier files remain untouched.
- A source relink mismatch, unsupported codec/container feature, missing keyframe, write denial, insufficient disk space, or mux failure is isolated to the affected clip.
- Diagnostics may include browser, codec, source size, error code, and application version, but never media content or player names.

## License impact

Mediabunny uses MPL-2.0. It may be used and distributed in this open-source application. If the project modifies and distributes Mediabunny's own licensed source files, those modifications must remain available under MPL-2.0. The planned integration imports the unmodified package, records its license in third-party notices, and keeps application code under the project's future license.

MP4Box.js uses BSD-3-Clause and has fewer reciprocal obligations, but the license advantage does not offset its higher implementation risk for this workflow.

## Prototype acceptance criteria

The dependency is accepted for production use only when a focused prototype demonstrates all of the following:

- A small synthetic H.264/AAC MP4 exports to a playable MP4 without re-encoding.
- The effective start is a verified keyframe at or before the requested in-point.
- Video and audio remain synchronized and both streams are present.
- A B-frame fixture remains decodable after timestamp rebasing.
- Output streams to disk with bounded memory use.
- Progress and cancellation work without corrupting already completed outputs.
- Chrome and the user's installed Brave build report their capability accurately.
- A real ShadowPlay VOD exports successfully before the feature is considered usable.
- AMD Adrenalin and OBS fixtures are added when available; lack of those fixtures remains visible rather than being treated as proven compatibility.

## Sources

- [Mediabunny overview and license](https://github.com/Vanilagy/mediabunny/blob/main/README.md)
- [Mediabunny conversion and trimming behavior](https://mediabunny.dev/guide/converting-media-files)
- [Mediabunny encoded packet sources](https://mediabunny.dev/guide/media-sources)
- [Mediabunny encoded packet sinks and keyframe verification](https://mediabunny.dev/guide/media-sinks)
- [Mediabunny streaming output target](https://mediabunny.dev/api/StreamTarget)
- [MP4Box.js parsing, segmentation, extraction, and seek APIs](https://github.com/gpac/mp4box.js/blob/main/README.md)
- [MP4Box.js BSD-3-Clause license](https://github.com/gpac/mp4box.js/blob/main/LICENSE)
- [Chrome File System Access API guidance](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
