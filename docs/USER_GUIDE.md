# User Guide

> [!NOTE]
> Local project management, source-file import, one sync point per perspective, synchronized perspective switching, event-name navigation, clip marking, manual clip ordering, DaVinci Resolve timeline export, and an experimental direct lossless clip exporter are available now.

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

Use the red trash button on a VOD source card or its perspective tab to remove that perspective from the project. A confirmation explains which synchronization, filters, and marked clips will be removed. The original MP4 file on disk is never deleted.

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

The **Log events** track shares the visible video-time scale. Kills are green, deaths are red, and dense areas are combined into numbered bundles. Choose any marker, including a bundle, to select its representative event, seek the video to that calculated position, center the visible timeline, and pause. Use timeline zoom when bundled events need to be separated. Before the first synchronization point is saved, the selected event and current video frame form a clearly labelled preview alignment; afterward the track uses the stored alignment.

Stop on the matching event and choose **Set synchronization point**.

Every VOD has its own synchronization offset. Select another perspective above the player to synchronize it independently. Existing points can be updated. The current browser implementation uses detected FPS when available and otherwise visibly estimates 60 FPS; it does not promise a professional frame index.

### 4. Switch perspectives

The synchronization workspace displays one active VOD at full size. Choose another perspective in the tabs above the player to switch recordings. Switching synchronized perspectives preserves the shared session position, so the new recording opens at the same event moment. Only the active VOD is loaded into the player; the synchronization workspace does not use a split screen or miniplayers.

### 5. Search events

Add one or more family, character, or guild names. Searches ignore case and support partial matches. Multiple active names use OR matching and can be removed individually.

This synchronization search is temporary and independent for every VOD during the current session. It is intended for comparing visible Ingame timestamps with nearby log events. It never adds clipping timelines, changes clip filters, or affects saved clips. Use **Previous matching event** and **Next matching event** to move between matches inside the active VOD's available time range. Selecting a result directly has the same effect. The main and visible synchronized videos seek to that shared moment and pause.

### 6. Mark clips

After saving a synchronization point, choose **Start Clipping** below the synchronization button. This opens a separate workspace with one large active video and a timeline that uses the full page width. Project navigation, source import, and source cards are hidden in this focused view. When more synchronized VODs are linked, **Split screen** shows all perspectives together; the active perspective continues to control playback and the timeline. Use the speaker icon on each perspective tab to enable or mute its audio. Use **Back to synchronization** whenever an anchor or name filter needs adjustment; the hidden project sections then return.

The timeline contains shared **Kills** and **Deaths** rows. The video playhead and all event tracks use the same horizontal time scale, so vertically aligned markers represent the same video moment. Enter a family, character, or guild name directly beside **Selected names** and choose **Add name timeline** (or press Enter). Every added name receives its own independently filtered event row and can be removed again. Only these user-created name timelines summarize 15-second kill bursts: two kills show the gold **I: Challenger!** badge, three the red **II: Invader!**, four the violet **III: Slayer!**, and five or more the pink **IV: Conqueror** badge. One banner represents the complete burst from its first through its final kill; nearby ordinary events remain on a separate lower level. If full banners would overlap at the current zoom, they collapse to their diamond emblems and expand automatically as soon as zooming provides enough horizontal room. Each diamond contains its centered Roman tier. The shared synchronization timeline and fixed **Kills** and **Deaths** rows retain their normal marker and bundle styles. Use the split icon beside a selected name to separate its combined row into individual kill and death rows; its kill row keeps the streak notifications while its death row does not. Select the icon again to merge the rows. This layout is saved per VOD and restored with the project. Add more names whenever another dedicated timeline is useful. Extra VOD perspectives do not create extra timeline rows; switch the active perspective above the player instead.

Select a timeline event to create a starting range from 10 seconds before through 10 seconds after that event. For a combined kill-streak banner, the range starts 10 seconds before its first kill and ends 10 seconds after its final kill. You can also pause on the desired start and choose **Set start (I)**, then move to the desired end and choose **Set end (O)**. The `I` and `O` keys perform the same actions in the clipping workspace. Refine both boundaries with the larger timeline handles: lime marks the in-point and blue marks the out-point. Both remain aligned to the visible timeline while zooming. Choose **Save clip** when the range is ready.

The video timeline generates a small local frame overview for the currently visible time window. It samples only a limited number of frames from the selected VOD and does not upload or copy the recording.

The clip is saved locally with its source perspective, exact range, duration, active-name snapshot, and matching events inside the range. Its generated title uses the active names when available and can be edited in **Marked clips**. Choose **Preview** to switch to the source perspective, seek to the clip's in-point, play it in the main player, and pause automatically at its out-point. Drag the grip on a clip onto another clip to change the saved order. The up/down buttons provide the same operation without dragging. Clips can be deleted and the panel can be collapsed. Later search changes do not modify existing clip snapshots.

### 7. Export

Select the checkbox on one or more clip cards and choose **Export selected clips** to export only that subset in the saved manual order. **Export all clips** writes every marked clip. Both actions ask for a destination folder. The source VOD for each clip must be reselected in the current browser session. Open the local app directly in current Chrome or Edge for the required writable-folder access. Brave intentionally disables the File System Access API used by this large-file export, while embedded preview browsers may display the folder dialog but still refuse to grant the resulting handle. The rest of the application and DaVinci Resolve timeline export remain usable in Brave.

This browser export is experimental and prioritizes losslessness. It copies the original encoded video and audio without re-encoding, so the effective start may move to the preceding safe video keyframe and the end may extend to the following keyframe. The completed result shows the effective range. When one clip fails or the batch is cancelled, completed earlier clips remain in the chosen folder and a newly created incomplete file is removed.

After a successful browser export, the result lists the generated filename and effective range. A website cannot reveal the private absolute directory path or launch Windows Explorer from its protected directory handle. The planned desktop application will add a folder icon to every successful clip result and reveal that file directly in Explorer.

**Export to DaVinci Resolve** creates an FCPXML file with one gapless edit timeline. It follows the saved manual clip order, keeps every clip attached to its original VOD time range, and includes video and source audio. Adjust timeline frame rate, width, and height before exporting; these values are saved with the project. The default is 60 FPS and the largest detected VOD resolution.

In Resolve, use **File → Import → Timeline** and select the exported `.fcpxml` file. The website intentionally stores only source filenames, not private full paths. If Resolve reports missing media, point its relink action at the folder containing the original VODs.

### 8. Save or transfer a project

Projects autosave locally in the current browser. Use **Export** on a project card to create a portable `.bdo-vod-project.json` file containing the embedded log, synchronization data, searches, clips, ordering, and relevant UI state. VOD contents are never embedded and must be selected again on another session or computer.

## Keyboard controls

- Space: play/pause from anywhere in the synchronization or clipping workspace
- Left/right arrow: approximate previous/next frame and pause; held-key repeats are rate-limited to avoid queuing expensive large-file seeks
- `I`: set the clip in-point in the clipping workspace
- `O`: set the clip out-point in the clipping workspace
- Shortcuts are suspended while typing in a text field, text area, or editable text element.
- Documented shortcuts will be provided for previous/next matching event and perspective switching.

All keyboard actions will also have accessible buttons.
