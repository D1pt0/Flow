# Building on Windows

## Requirements

- Python 3.10 or newer, available as `python`.
- JDK 21.
- Android SDK platform 35 and build-tools 35.0.0.
- Internet access for pinned dependency downloads.

Obtain Java and the Android SDK from their official publishers. With the Android
SDK command-line tools installed, use `sdkmanager "platforms;android-35" "build-tools;35.0.0"`
and accept the SDK licenses through the normal SDK setup.

## Build

From the repository root in PowerShell, substitute your SDK and JDK paths:

```powershell
./scripts/build.ps1 -Jdk "C:/Java/jdk-21" -Sdk "C:/Android/sdk"
```

The helper downloads the dependencies into `.dependencies`, then calls the
manual Android build in `android/build.py`. AAPT2 compiles resources, javac
compiles Java, D8 emits DEX, and zipalign/apksigner align and sign the APK.

Output is `release/Flow-Android-v1.8.apk`. Four native CPU architectures are
included. Build work is kept in `.build`.

The scripts do not require Gradle or Android Studio.

## Signing and updates

The build tool generates `flow-signing.p12` and `signing.json` in its work
directory on the first build. Keep those files together in a private backup and
reuse them for later builds. They are excluded from Git.

Pass `-BuildDirectory` to the helper to reuse an existing build/signing directory.
A fresh signing directory produces a different certificate. Such an APK cannot
update the published APK in place. The private signing material used for the
provided release is deliberately kept outside this repository and its source
archive.

## Dependencies and replacement libraries

`android/fetch-native.py` pins the upstream artifact versions and validates
downloads against publisher checksums. `android/build.py` accepts a `--native`
directory containing the extracted library classes and shared objects.
Replacement or modified native dependencies can be supplied there.

The package includes unmodified LibVLC 3.7.7. Published Java binding source is
under `android/third-party/`. Native engine, contrib source references and
licenses are listed in `THIRD-PARTY-NOTICES.md`.

## Source archive

`release/Flow-Source-v1.8.0.zip` contains the repository's tracked source files,
including notices and the published Java-binding source. It excludes SDKs,
downloaded native binaries, APKs, signing material, build directories and Git
history.

## Regression checks

With Node.js 18 or newer installed, run from the repository root:

~~~powershell
node tests/run.cjs
~~~

These checks exercise cache expiry, watched history, title suggestions,
poster-card reuse, deferred painting, recommendation mixing and category
search. They use local fixtures. They do not simulate video decoding or phone
touch hardware.

The release-helper regression check can also be run with Windows PowerShell 5.1
or PowerShell 7 from the repository root using ./tests/publish-probes.ps1.
It performs read-only local Git probes and makes no network requests.
