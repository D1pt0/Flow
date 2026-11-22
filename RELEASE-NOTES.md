# Flow 1.8.0

Android media player by **Dabobbroto Chakroborty**.

## Downloads

- **Flow-Android-v1.8.apk** — Android 8.0 or newer. Install over an earlier Flow version.
- **Flow-Source-v1.8.0.zip** — app source, build scripts and dependency notices.
- **SHA256SUMS.txt** — SHA-256 checksums for both downloads.

## Included in this release

- Native LibVLC playback for server streams, direct media links and on-device audio/video.
- Server-wide indexing with category and folder search scopes.
- Priority scanning for the selected collection, with independent completion status.
- Search suggestions, online posters and short movie introductions.
- Recent releases mixed with older favourites, with stable Show more pagination.
- Watched history, watchlist, resume playback and automatic cache expiry.
- Stable poster cards during background indexing and scrolling.
- Pinch zoom, landscape fullscreen and brightness/volume gestures.

## Connect

Use the link menu to save your media server's directory URL. The initial address,
`http://172.16.50.4/`, works only on networks that can reach that server. Grant
video/audio access in On device to display shared media folders.

## Verification and limits

Native compilation, APK signatures, packaged assets and four CPU architectures
were checked. Automated app-logic checks cover scoped indexing, suggestions,
cache expiry, watched filtering, recommendation mixing and poster-card reuse.

Playback performance and Android-specific permission, touch and display behavior
still need testing across more devices. Online artwork and chart services may
be unavailable. Unrated recommendations do not have inferred review scores.

Third-party credits and source references are included in the source archive
and the app's About dialog.
