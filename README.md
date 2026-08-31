# BDO VOD Scanner

BDO VOD Scanner is a local-first editor tool for synchronizing a Black Desert Online event log with one or more MP4 VOD perspectives. It helps players and video editors find relevant moments, compare perspectives, mark clips, and prepare exports for DaVinci Resolve.

> [!IMPORTANT]
> This project is in early development. The application runs locally in the browser; direct lossless media-clip export is available as an experimental Chromium-only prototype.

All logs and videos are intended to remain on the user's computer. The application must not upload imported media or event data.

BDO VOD Scanner is an unofficial community project and is not affiliated with or endorsed by Pearl Abyss.

## Web application

The current public build is available at [newage-bd.github.io/bdo-vod-scanner](https://newage-bd.github.io/bdo-vod-scanner/).

Imported logs, VODs, project data, and generated clips remain on the user's device. GitHub Pages only hosts the static application files. Large VOD references may need to be selected again after reopening the browser.

## Documentation

- [Master project instructions](docs/MASTER_PROMPT.md)
- [User guide](docs/USER_GUIDE.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Portable project format](docs/PROJECT_FORMAT.md)
- [Media and browser support](docs/MEDIA_SUPPORT.md)
- [Privacy and security](docs/PRIVACY_AND_SECURITY.md)
- [Changelog](CHANGELOG.md)

## Current status

The application now provides named local projects, portable project import/export, drag-and-drop source import, exact BDO log parsing, MP4 signature checks, native local VOD playback, an independently zoomable and pannable video image, synchronized video/log timeline tracks with bundled event markers, approximate frame stepping, session-safe VOD relinking, one independently stored synchronization anchor per perspective, shared-time switching between full-size perspectives, temporary synchronization-name navigation, and a dedicated full-width clipping workspace with persistent per-perspective name timelines, optional per-name kill/death splits, editable clip handles, saved drag ordering, clip previews, selectable direct-export batches, locally stored clip titles, and gapless FCPXML timeline export for DaVinci Resolve. Direct media export remains experimental.

See the [development guide](docs/DEVELOPMENT.md) to run the current application locally.

## License

Copyright © 2026 NewAge-BD.

This project is free software licensed under the [GNU Affero General Public License, version 3 or later](LICENSE). Modified versions and network-hosted derivatives must make their corresponding source code available under the same license. See `LICENSE` for the complete terms.
