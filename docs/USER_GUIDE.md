# User Guide

> [!NOTE]
> This guide describes the planned MVP. The application has not been implemented yet.

## What BDO VOD Scanner does

BDO VOD Scanner aligns one BDO event log with one or more local MP4 recordings. After synchronization, it lets users search event names, compare player perspectives at the same moment, mark clip ranges, export experimental lossless clips, and create a DaVinci Resolve timeline.

Imported files remain local and are never uploaded.

## Planned workflow

### 1. Create or open a project

The project overview stores multiple named projects in the browser. A portable project file can also be imported.

### 2. Import files

Drag one `YYYY-MM-DD.log` file and one or more MP4 VODs onto the import surface.

For every VOD, the application displays filename, size, duration, resolution, detected frame rate, codec information, and synchronization status.

### 3. Synchronize every VOD

Each unsynchronized VOD has a highlighted **Sync** button.

The first log event is proposed by default. If it is difficult to locate in the kill feed, chat, or notifications, select a different event. Navigate the video visually frame by frame, stop on the matching event, and confirm.

Every VOD has its own synchronization offset.

### 4. Compare perspectives

The preview adapts to the number of visible VODs. Click a perspective to make it the main video. Other visible perspectives continue as muted miniplayers, while hidden perspectives do not consume active playback resources.

Only the main video is audible. Switching perspectives preserves the shared event position.

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

Projects autosave locally. Use **Export project** to create a portable project file containing the embedded log, synchronization data, searches, clips, ordering, and relevant UI state. VOD contents are never embedded and must be selected again on another session or computer.

## Planned keyboard controls

- Space: play/pause
- Left/right arrow: approximate previous/next frame while paused
- `I`: set clip in-point
- `O`: set clip out-point
- Documented shortcuts will be provided for previous/next matching event and perspective switching.

All keyboard actions will also have accessible buttons.
