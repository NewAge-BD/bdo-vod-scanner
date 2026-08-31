# BDO VOD Scanner

**Find the fights worth keeping — without uploading your VODs or combat logs.**

BDO VOD Scanner is a local-first browser tool for Black Desert Online players and video editors. It aligns one event log with multiple MP4 perspectives, turns kills and deaths into searchable timelines, and helps you build clips for direct export or DaVinci Resolve.

[Open BDO VOD Scanner](https://newage-bd.github.io/bdo-vod-scanner/) · [Read the user guide](docs/USER_GUIDE.md) · [View the latest release](https://github.com/NewAge-BD/bdo-vod-scanner/releases/latest)

> [!IMPORTANT]
> Logs, VODs, projects, OCR screenshots, and generated clips stay on your device. The application has no backend, accounts, telemetry, or upload service.

## What you can do

- **Synchronize every perspective** manually or with the experimental local chat OCR assistant.
- **Search combat events** by family, character, or guild name across a zoomable shared timeline.
- **Spot kill streaks** with Challenger, Invader, Slayer, and Conqueror timeline banners.
- **Compare perspectives** at the same session moment in single-view or split-screen mode.
- **Build precise clips** with editable in/out points, frame stepping, previews, titles, and ordering.
- **Export your edit** as experimental lossless MP4 cuts or a gapless FCPXML timeline for DaVinci Resolve.
- **Keep projects portable** without embedding huge video files.

## Quick start

1. Open the [web application](https://newage-bd.github.io/bdo-vod-scanner/) in a current Chromium-based desktop browser.
2. Create a project and add one supported event log plus one or more MP4 perspectives.
3. Synchronize each VOD to a visible combat-log message. Auto Sync can scan a marked in-game chat area locally and propose a matching frame.
4. Open the clipping workspace, add name timelines, select events, and refine the suggested clip ranges.
5. Export individual clips or create a DaVinci Resolve timeline.

### Getting a GuildYapper log

The importer contains a built-in guide: open [GuildYapper](https://guildyapper.com/), hover over your name, choose **Scores**, select the correct Node War or Siege, and download its log.

## Supported inputs

| Source             | Current support                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| BDO event logs     | Dated `.log` files using canonical BDO, GuildYapper `killed`, `has killed`, or `died to` events |
| Ikusa sessions     | Validated `ikusa-raw-session` v4 files ending in `.ikusa.json`                                  |
| Video perspectives | Local MP4 files supported by the browser's installed codecs                                     |

Only the small raw event log and project metadata are stored in the browser. VOD contents are never copied into browser storage or portable project files. After reopening the browser, the original MP4 files may need to be selected again.

## Auto Sync

Experimental Auto Sync uses a locally bundled OCR engine. Mark the in-game chat, start scanning near a readable combat message, and review the proposed first visible frame before saving the synchronization point. Recognition works best with BDO's crop mode when the chat is positioned over the grey area.

No cropped image or recognized chat text leaves the browser or is saved in the portable project.

## Browser and export notes

- Current Chrome and Edge provide the complete browser workflow, including writable-folder access for direct clip export.
- Brave can use the core project, synchronization, clipping, and DaVinci features, but intentionally disables the writable-folder API required by direct clip export.
- Codec support depends on the browser and Windows installation.
- Browser frame stepping is approximate, and lossless cuts may expand to nearby safe keyframes.
- VOD files can be very large; the application keeps references instead of loading complete recordings into memory.

See [Media and browser support](docs/MEDIA_SUPPORT.md) for details.

## Run locally

Requirements: Node.js 24 LTS and npm 11 or newer.

```bash
npm install
npm run dev
```

Before contributing, run the complete validation suite:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

See the [development guide](docs/DEVELOPMENT.md) and [contributing guide](CONTRIBUTING.md) for the full setup.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Portable project format](docs/PROJECT_FORMAT.md)
- [Media and browser support](docs/MEDIA_SUPPORT.md)
- [Privacy and security](docs/PRIVACY_AND_SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)

## Project status

BDO VOD Scanner is in active development. The public build is an unofficial community project and is not affiliated with or endorsed by Pearl Abyss.

## License

Copyright © 2026 NewAge-BD.

This project is free software licensed under the [GNU Affero General Public License, version 3 or later](LICENSE). Modified versions and network-hosted derivatives must make their corresponding source code available under the same license. See `LICENSE` for the complete terms.
