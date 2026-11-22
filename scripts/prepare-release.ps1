[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$repository = Split-Path $PSScriptRoot -Parent
Push-Location $repository
try {
    $manifest = [xml](Get-Content -Raw android/AndroidManifest.xml)
    $version = $manifest.manifest.GetAttribute("versionName", "http://schemas.android.com/apk/res/android")
    $displayVersion = $version -replace '\.0$', ''
    $release = Join-Path $repository "release"
    $apk = Join-Path $release "Flow-Android-v$displayVersion.apk"
    if (-not (Test-Path -LiteralPath $apk)) { throw "Build or copy the release APK first: $apk" }
    $changes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "Initialize and commit the source repository first." }
    if ($changes) { throw "Commit source changes before preparing the source archive." }
    $source = Join-Path $release "Flow-Source-v$version.zip"
    & git archive --format=zip "--prefix=Flow-v$version/" "--output=$source" HEAD
    if ($LASTEXITCODE -ne 0) { throw "Source archive creation failed." }
    $lines = foreach ($asset in @($apk, $source)) {
        $digest = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant()
        "$digest  $([IO.Path]::GetFileName($asset))"
    }
    [IO.File]::WriteAllText((Join-Path $release "SHA256SUMS.txt"), (($lines -join [Environment]::NewLine) + [Environment]::NewLine), [Text.Encoding]::ASCII)
    Write-Host "Release files prepared in $release"
} finally { Pop-Location }
