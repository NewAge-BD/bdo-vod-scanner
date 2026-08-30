# BDO VOD Scanner

BDO VOD Scanner is a planned local-first editor tool for synchronizing a Black Desert Online event log with one or more MP4 VOD perspectives. It is intended to help players and video editors find relevant moments, compare perspectives, mark clips, and prepare exports for DaVinci Resolve.

> [!IMPORTANT]
> This project is in private, early development. The application runs locally, but clip ordering and export are not implemented yet.

All logs and videos are intended to remain on the user's computer. The application must not upload imported media or event data.

BDO VOD Scanner is an unofficial community project and is not affiliated with or endorsed by Pearl Abyss.

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

The application now provides named local projects, portable project import/export, drag-and-drop source import, exact BDO log parsing, MP4 signature checks, native local VOD playback, an independently zoomable and pannable video image, synchronized video/log timeline tracks with bundled event markers, approximate frame stepping, session-safe VOD relinking, one independently stored synchronization anchor per perspective, coordinated multi-perspective playback with muted miniplayers, temporary synchronization-name navigation, and a dedicated full-width clipping workspace with persistent per-perspective name timelines, optional per-name kill/death splits, editable clip handles, saved drag ordering, and locally stored clip titles. Media exports remain an upcoming milestone.

See the [development guide](docs/DEVELOPMENT.md) to run the current application locally.

## License

No license has been selected. The repository must remain private until an open-source license and public-release plan have been explicitly approved.
