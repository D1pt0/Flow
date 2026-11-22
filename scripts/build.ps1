[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Jdk,
    [Parameter(Mandatory)][string]$Sdk,
    [string]$BuildTools = "35.0.0",
    [string]$BuildDirectory
)
$ErrorActionPreference = "Stop"
$repository = Split-Path $PSScriptRoot -Parent
if (-not $BuildDirectory) { $BuildDirectory = Join-Path $repository ".build" }
$nativeDirectory = Join-Path $repository ".dependencies"
$manifest = [xml](Get-Content -Raw (Join-Path $repository "android/AndroidManifest.xml"))
$version = $manifest.manifest.GetAttribute("versionName", "http://schemas.android.com/apk/res/android")
$displayVersion = $version -replace '\.0$', ''
$output = Join-Path $repository "release/Flow-Android-v$displayVersion.apk"
foreach ($path in @((Join-Path $Jdk "bin/javac.exe"), (Join-Path $Sdk "platforms/android-35/android.jar"), (Join-Path $Sdk "build-tools/$BuildTools/aapt2.exe"))) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing build dependency: $path" }
}
Push-Location $repository
try {
    & python android/fetch-native.py --directory $nativeDirectory
    if ($LASTEXITCODE -ne 0) { throw "Dependency retrieval failed." }
    & python android/build.py --java-home $Jdk --platform (Join-Path $Sdk "platforms/android-35") --build-tools (Join-Path $Sdk "build-tools/$BuildTools") --native $nativeDirectory --work $BuildDirectory --output $output
    if ($LASTEXITCODE -ne 0) { throw "Android build failed." }
} finally { Pop-Location }
