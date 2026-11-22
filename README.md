# Flow

**A mobile-first Android player for media servers, direct links and files on your phone.**

Developed by **Dabobbroto Chakroborty**.

[Download](https://github.com/D1pt0/Flow/releases/latest) · [Report an issue](https://github.com/D1pt0/Flow/issues/new/choose)

## Get started

1. Download **Flow-Android-v1.8.apk** from Releases and install it on an Android 8.0 or newer phone.
2. Connect to the Wi-Fi or ISP network that provides your media server.
3. Open the link menu, select **Use as my media server**, and enter its directory address.
4. Browse a collection, search for a title, or open **On device** to play local media.

The initial server address is `http://172.16.50.4/`. Other networks require their own reachable server address. Flow runs directly on the phone.

## Features

- Built-in LibVLC playback with hardware and software decoding, audio tracks, subtitles and playback speed.
- HTTP/HTTPS directory indexes, anonymous FTP listings and direct network media links.
- Whole-server search with category and folder scopes, including older years and series seasons.
- Movie-name suggestions with availability within the selected collection.
- Posters and short introductions from online sources, with local title cards when artwork is unavailable.
- A mixed feed of recent releases and older favourites, a watchlist and watched history.
- Shared video/audio folders through Android's media library and optional document-picker access.
- Landscape fullscreen, picture-size presets, pinch zoom, brightness and volume swipes.
- Bookmarks, chapter selection, equalizer, picture adjustments, sleep timer and saved frames.
- Seven-day cache expiry and a manual cache-clear option.

New server titles appear as the catalog refreshes. The first scan can take time on large collections. Unavailable folders are reported, and partial results remain labeled until their collection finishes scanning.

## Playback controls

| Action | Control |
| --- | --- |
| Landscape fullscreen | Tap the fullscreen button |
| Brightness | Swipe vertically on the left half of the video |
| Media volume | Swipe vertically on the right half |
| Zoom | Pinch with two fingers |
| Seek | Drag horizontally, use the timeline, or double-tap a side |
| Audio, subtitles and display | Quick toolbar and the three-dot menu |

Choosing a size preset resets pinch zoom. Fit preserves the picture, while Fill can crop it to match the screen.

## Privacy and permissions

No account is required. Media-library permissions allow **On device** to group shared media into folders. File and folder pickers grant access to selected documents. Movie-title lookups contact IMDb and Wikipedia/Wikidata, and poster downloads contact their image hosts. Watchlist, watched history, playback progress and server settings stay on the device.

See [Privacy](docs/PRIVACY.md) and [Usage](docs/USAGE.md).

## Requirements and limits

- Android 8.0/API 26 or newer.
- A reachable media server for network playback. Private ISP addresses usually require that provider's network.
- Browsable directory listings for catalog indexing. Login pages, SFTP and custom server search APIs require additional integration.
- Codec performance depends on the device and file profile. DRM-protected streams are unsupported.
- Artwork and public chart endpoints can be unavailable. Curated Flow picks and title cards provide fallbacks.

The current release is **1.8.0**. The APK uses the same signing certificate as the earlier private Flow releases. App logic, native compilation, package assets and signing have automated checks. Device-specific playback, permissions and touch behavior require testing across real phones.

## Source and building

- `android/` contains the app manifest, native Java player, catalog interface and build tools.
- `docs/` contains usage, privacy and build instructions.
- `licenses/` and `THIRD-PARTY-NOTICES.md` contain dependency credits and license information.
- `scripts/` contains Windows build and release helpers.

See [Building](docs/BUILDING.md) and [Third-party notices](THIRD-PARTY-NOTICES.md). Downloadable source accompanies the APK in Releases. Movie files and remote poster artwork are fetched at runtime and are not bundled in this repository.
