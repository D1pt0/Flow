# Privacy

Flow stores server settings, folder grants, watchlist, watched history, bookmarks
and playback positions locally on the phone. Android app backup is disabled.
The app includes no analytics, advertising SDK or account service.

## Network requests

- The selected media server receives directory-listing and playback requests.
- IMDb receives movie-title and search-suggestion queries. Public charts may
  also be requested for recommendations.
- Wikipedia and Wikidata receive title queries for introductions and facts.
- Poster image requests go to the relevant artwork host.

Those services receive normal connection information such as the phone's IP
address. Their own privacy terms apply. On-device files do not automatically
trigger title lookups.

## Permissions

- Internet access allows server playback and optional online information.
- Audio-setting access supports the player's media-volume controls.
- Video/audio library access groups shared media into folders.
- On older Android versions, storage read access serves the media-library scan.
- Android's document picker can grant access to specific files or folders.

No broad all-files management permission is requested. Flow does not upload
local media. Opening a file from a cloud document provider may contact that
provider.

## Cache and personal data

Disposable artwork references, movie information and catalog snapshots expire
after seven days. Cleanup runs when Flow opens or resumes. About has a manual
Clear cached data control. That action preserves personal library records.
Android/WebView-managed storage and the bundled player also occupy app space.

Watched titles, saved titles and progress remain until changed or the app's data
is cleared. Clearing Android app storage or uninstalling Flow removes local
application records.
