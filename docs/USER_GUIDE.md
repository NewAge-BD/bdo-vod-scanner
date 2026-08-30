# User Guide

> [!NOTE]
> Local project management, source-file import, one sync point per perspective, synchronized timelines, and coordinated multi-perspective playback are available now. Event navigation after synchronization, clip editing, and export remain planned MVP work.

## What BDO VOD Scanner does

BDO VOD Scanner aligns one BDO event log with one or more local MP4 recordings. After synchronization, it lets users search event names, compare player perspectives at the same moment, mark clip ranges, export experimental lossless clips, and create a DaVinci Resolve timeline.

Imported files remain local and are never uploaded.

## Workflow

### 1. Create or open a project

The project overview stores multiple named projects in this browser. Use **New project** to create one. Existing project cards can be opened, renamed, exported, or deleted. Deletion requires confirmation.

Use **Import project** to select a `.bdo-vod-project.json` file. Import opens the project immediately. A project with the same internal ID as an existing local project is rejected to avoid replacing local work.

### 2. Import files

Drag one `YYYY-MM-DD.log` file and one or more MP4 VODs onto the import surface.

The same files can be selected with **Choose log and MP4 files**. The log is validated against the exact BDO event format. Invalid individual MP4s and unrelated files are skipped without discarding valid sources from the selection.

For every VOD, the application displays filename, size, duration, resolution, available frame-rate/codec information, synchronization status, and current file-link state. Native browsers often do not expose frame rate or codec names; the UI reports this rather than guessing.

Only metadata is saved for VODs. After reloading the app, **Reselect required** means the original local MP4 must be selected again. A matching filename, size, and last-modified time safely relinks the file without creating a duplicate VOD. The raw log is small and is embedded in the project.

### 3. Synchronize every VOD

Each unsynchronized VOD is highlighted as **Sync required**. Open it in **Synchronize VODs**.

The first log event is proposed by default. If it is difficult to locate in the kill feed, chat, or notifications, search a family, character, or guild name and select a different event.

Use the video timeline below the player to find the matching frame:

- Drag the bright playhead to scrub through the visible time range. The player pauses while seeking.
- Scroll the mouse wheel over the timeline to zoom around the pointer position.
- Hold the middle mouse button and drag the timeline to move the visible time window.
- Double-click the timeline to reset its time zoom.
- Use **Zoom in** or the zoom slider to enlarge a short section around the current frame.
- Use **Earlier** and **Later** to move through the recording while zoomed in.
- Use **Previous frame** and **Next frame** for the final approximate frame adjustment.

To inspect a small visual detail such as the kill feed or chat, scroll the mouse wheel over the video image. While zoomed in, hold the middle mouse button and drag to move the image. Double-click the image or choose **Reset view** to return to the complete frame. Video-image zoom and timeline time zoom are independent.

The **Log events** track shares the visible video-time scale. Kills are green, deaths are red, and dense areas are combined into neutral numbered bundles. Choose an individual marker to select that event, seek the video to its calculated position, and pause. Choose a bundle to zoom into that group. Before the first synchronization point is saved, the selected event and current video frame form a clearly labelled preview alignment; afterward the track uses the stored alignment.

Stop on the matching event and choose **Set synchronization point**.

Every VOD has its own synchronization offset. Select another perspective above the player to synchronize it independently. Existing points can be updated. The current browser implementation uses detected FPS when available and otherwise visibly estimates 60 FPS; it does not promise a professional frame index.

### 4. Compare perspectives

The preview adapts to the number of visible VODs. Click a perspective to make it the main video. Other visible perspectives continue as muted miniplayers, while hidden perspectives do not consume active playback resources.

Only the main video is audible. Click a miniplayer or its **Open as main perspective** control to promote it. Switching perspectives preserves the shared session position. An unsynchronized, unlinked, or out-of-range perspective displays a status placeholder instead of stale video.

Use **Hide mini** beside a perspective to remove it from the grid and stop its active playback resources. Use **Show mini** to restore it. More than four visible perspectives trigger a dismissible performance warning; playback remains available.

### 5. Search events

Search across family names, character names, and guild names. Searches ignore case and support partial matches. Multiple terms use OR matching.

Every VOD may keep its own search terms. Use the previous/next controls to move between matching events. Selecting an event seeks synchronized videos to that moment and pauses.

### 6. Mark clips

Use the in/out buttons or keyboard shortcuts to mark a range on the selected perspective. Refine the range with timeline handles, add a title, and place it in the clip list.

The clip keeps a snapshot of the active search terms and matching events even if the perspective's search later changes.

### 7. Export

**Export all clips** writes the selected-perspective clips to a chosen folder. This browser export is experimental and prioritizes losslessness, so clip boundaries may expand to safe keyframes.

**Export to DaVinci** creates one ordered edit timeline with original video and audio references. Browser exports may require manual relinking because websites cannot reliably obtain full local source paths.

### 8. Save or transfer a project

Projects autosave locally in the current browser. Use **Export** on a project card to create a portable `.bdo-vod-project.json` file containing the embedded log, synchronization data, searches, clips, ordering, and relevant UI state. VOD contents are never embedded and must be selected again on another session or computer.

## Planned keyboard controls

- Space: play/pause
- Left/right arrow while the video is focused: approximate previous/next frame and pause
- `I`: set clip in-point
- `O`: set clip out-point
- Documented shortcuts will be provided for previous/next matching event and perspective switching.

All keyboard actions will also have accessible buttons.
