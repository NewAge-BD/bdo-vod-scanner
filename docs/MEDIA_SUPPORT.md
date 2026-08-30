# Media and Browser Support

## MVP support target

- Windows desktop
- Current stable Chrome, Brave, and Edge
- A reasonable previous stable Chromium generation
- MP4 containers only
- Recordings commonly produced by NVIDIA ShadowPlay, AMD Adrenalin, and OBS

Container support does not guarantee codec support. An MP4 may contain H.264, HEVC, or another codec whose playback availability depends on the browser and Windows installation.

The current importer verifies the MP4 `ftyp` file signature and asks the browser for native metadata. Duration and resolution are stored when available. Chromium's native video element does not expose reliable frame-rate, variable-frame-rate, or codec names, so those fields remain visibly unavailable instead of being guessed. Deeper MP4 inspection is a later milestone and may require an approved media dependency.

## File-size requirements

The supplied reference VOD is approximately 58 GB. Individual VODs may reach approximately 100 GB, and a project may contain many perspectives.

Mandatory rules:

- Never read a complete large VOD into memory.
- Never copy a VOD into IndexedDB, localStorage, or the portable project.
- Prefer metadata reads, streaming, and targeted byte ranges.
- Release obsolete object URLs, decoders, buffers, and worker resources.
- Decode only visible players.
- Warn when the number and resolution of visible VODs may exceed practical hardware capacity.
- Let the user continue after acknowledging the warning.

The current UI warns when a project contains more than eight VOD references and separately warns when more than four perspectives are visible. Hidden perspectives are unmounted so they do not retain an active object URL, player, or decoder.

## Playback

Use native HTML video playback when the codec is supported. Display a clear error when it is not, while preserving the rest of the project.

Only the main video is audible. Visible miniplayers are muted and follow shared session time plus the main play/pause intent. Hidden videos retain their project synchronization data but do not actively play or decode.

Outside a VOD's available source range, show no video content for that perspective.

## Frame navigation

The browser MVP promises visual frame-by-frame navigation, not a professional guaranteed frame index.

- Read nominal/average frame-rate metadata where possible.
- Account for fixed and variable frame rates.
- Use media presentation timestamps.
- Use `requestVideoFrameCallback` where it improves observation of presented frames.
- Step by the best available estimated frame duration.
- Surface uncertainty rather than claiming false precision.

Expected frame rates include 30, 60, 120, and 144 FPS.

The implemented player provides independent video-image and timeline-time zoom. Mouse-wheel input zooms the surface beneath the pointer, middle-button dragging pans that surface, and double-click resets it. The timeline also provides a draggable playhead, an exponentially zoomable visible time range, earlier/later panning controls, previous/next-frame buttons, and left/right arrow handling while the video is focused. Seeking pauses playback. Frame stepping uses `1 / FPS`; when the browser has not exposed an FPS value, the UI clearly labels the 60 FPS estimate. This is visual approximate navigation and not a guaranteed frame index.

## Direct clip export

Direct browser export is experimental.

- Preserve source quality and avoid re-encoding.
- Prefer losslessness over exact requested boundaries.
- Move the start to a safe preceding keyframe when required.
- Extend the end to a safe following keyframe when required.
- Preserve source audio.
- Stream output or use targeted ranges.
- Support progress, cancellation, partial success, and per-clip errors.
- Keep finished outputs when a later clip fails or the batch is cancelled.

The user selects an output directory when the browser capability is available. Directory access requires explicit permission and may not be available in every browser context; provide an actionable fallback message.

The media library is not yet selected. Evaluate candidates such as Mediabunny and MP4Box.js in a technical spike, then request dependency approval.

## DaVinci Resolve export

- Support at least the current free DaVinci Resolve version.
- Produce one timeline with clips in manual order and no gaps.
- Include original video and audio.
- Default to 60 FPS.
- Default to the largest imported VOD resolution.
- Let users override frame rate and resolution.
- Reference source filenames in the website.
- Attempt automatic matching where supported, with manual relinking as the reliable fallback.
- Select the exact interchange format only after a compatibility test.

## Synthetic test media

The repository may contain one very small, fully synthetic MP4 fixture with no game footage or personal data. Use it to test metadata handling and real export paths. Never commit the supplied real VOD.

## Future desktop support

The planned Windows application may add FFmpeg-based processing, full local paths, more reliable relinking, broader codecs and containers, stronger frame inspection, and complete offline operation.
