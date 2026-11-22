[CmdletBinding()]
param(
    [string]$Owner = "D1pt0",
    [string]$Name = "Flow",
    [ValidateSet("public", "private")][string]$Visibility = "public"
)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$repository = Split-Path $PSScriptRoot -Parent
function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed. Resolve the reported error before retrying." }
}
if ($Owner -notmatch '^[a-zA-Z0-9-]+$' -or $Name -notmatch '^[a-zA-Z0-9_.-]+$') { throw "Invalid repository owner or name." }
Push-Location $repository
try {
    Invoke-Checked "gh" @("auth", "status")
    $login = & gh api user --jq .login
    if ($LASTEXITCODE -ne 0) { throw "Could not identify the signed-in GitHub account." }
    if ($login.Trim() -ine $Owner) { throw "Sign in as $Owner with gh auth switch or gh auth login before publishing." }
    & "$PSScriptRoot/prepare-release.ps1"
    $manifest = [xml](Get-Content -Raw android/AndroidManifest.xml)
    $version = $manifest.manifest.GetAttribute("versionName", "http://schemas.android.com/apk/res/android")
    $tag = "v$version"
    $tagCommit = & git rev-list -n 1 $tag
    if ($LASTEXITCODE -ne 0) { throw "Create the release tag first: git tag -a $tag -m 'Flow $version'" }
    $headCommit = & git rev-parse HEAD
    if ($tagCommit -ne $headCommit) { throw "The release tag does not point at the current source commit." }
    $target = "$Owner/$Name"
    $expected = "https://github.com/$target.git"
    $remote = & git remote get-url origin 2>$null
    if ($LASTEXITCODE -eq 0) {
        $normalized = $remote -replace '^git@github.com:', 'https://github.com/'
        if (($normalized -replace '\.git/?$', '').TrimEnd('/') -ine "https://github.com/$target") { throw "origin points to a different repository." }
    } else { $remote = $null }
    & gh repo view $target --json nameWithOwner 1>$null 2>$null
    $exists = $LASTEXITCODE -eq 0
    if ($exists) {
        if (-not $remote) { Invoke-Checked "git" @("remote", "add", "origin", $expected) }
        Invoke-Checked "git" @("push", "-u", "origin", "main")
    } else {
        $create = @("repo", "create", $target, "--$Visibility", "--description", "Android media player for servers, direct links and local files")
        if (-not $remote) { $create += @("--source", ".", "--remote", "origin") }
        Invoke-Checked "gh" $create
        Invoke-Checked "git" @("push", "-u", "origin", "main")
    }
    Invoke-Checked "git" @("push", "origin", $tag)
    & gh release view $tag --repo $target 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Release $tag already exists. Review its assets at https://github.com/$target/releases/tag/$tag"
        return
    }
    $displayVersion = $version -replace '\.0$', ''
    Invoke-Checked "gh" @("release", "create", $tag, "release/Flow-Android-v$displayVersion.apk", "release/Flow-Source-v$version.zip", "release/SHA256SUMS.txt", "--repo", $target, "--title", "Flow $version", "--notes-file", "RELEASE-NOTES.md", "--verify-tag")
    Write-Host "Published https://github.com/$target/releases/tag/$tag"
} finally { Pop-Location }
