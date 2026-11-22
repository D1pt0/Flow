# Uploading to GitHub

The prepared checkout has a main branch, an initial source commit and a
v1.8.0 release tag. Its origin will be configured when publishing.

The default destination is **D1pt0/Flow**, matching the developer account used
for PocketLink. The helper creates a **public** repository and publishes the
APK and source as a GitHub Release. Nothing has been uploaded yet.

## Terminal helper

Open a PowerShell terminal in this repository:

~~~powershell
gh auth status
./scripts/publish.ps1
~~~

If GitHub CLI is not signed in, run gh auth login first and sign in as D1pt0.
The helper checks the account, verifies the source is committed, prepares
release checksums, creates the repository if needed, pushes main and v1.8.0,
and creates the release from RELEASE-NOTES.md.

For a private repository, use ./scripts/publish.ps1 -Visibility private.
Existing repository visibility is kept. A different repository name can be
passed with -Name. Update the README download and issue URLs first, commit
those changes, and create the release tag at that commit.

## Manual commands for a new repository

These commands use the already-prepared release assets:

~~~powershell
gh auth status
gh repo create D1pt0/Flow --public --description "Android media player for servers, direct links and local files" --source . --remote origin --push
git push origin v1.8.0
gh release create v1.8.0 release/Flow-Android-v1.8.apk release/Flow-Source-v1.8.0.zip release/SHA256SUMS.txt --repo D1pt0/Flow --title "Flow 1.8.0" --notes-file RELEASE-NOTES.md --verify-tag
~~~

If the repository already exists, set origin to its URL and push main instead
of running gh repo create. No force push is needed.

## Before publishing

~~~powershell
git status --short
git show --no-patch --format=fuller HEAD
git ls-files
~~~

APK files, release archives, dependency downloads, build caches and signing keys
are excluded by .gitignore. The small published LibVLC Java-binding source jar
is intentionally tracked as third-party source. License notices remain included.

Commit attribution uses your configured Git user name and email.
