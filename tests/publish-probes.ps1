$ErrorActionPreference = "Stop"
$repository = Split-Path $PSScriptRoot -Parent
$tokens = $null
$issues = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $repository "scripts/publish.ps1"), [ref]$tokens, [ref]$issues)
if ($issues.Count) { throw "Publish helper has syntax errors." }
$probe = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Invoke-Probe"}, $true)
if (-not $probe) { throw "Publish probe function is missing." }
. ([scriptblock]::Create($probe.Extent.Text))
Push-Location $repository
try {
    $missing = Invoke-Probe "git" @("remote", "get-url", "__flow_missing_test_remote__")
    if ($missing.ExitCode -eq 0) { throw "Expected an unavailable remote." }
    $valid = Invoke-Probe "git" @("rev-parse", "--is-inside-work-tree")
    if ($valid.ExitCode -ne 0 -or $valid.Output -ne "true") { throw "Successful probe failed." }
    $invalid = Invoke-Probe "git" @("rev-parse", "--verify", "refs/heads/__flow_missing_test_branch__")
    if ($invalid.ExitCode -eq 0) { throw "Expected an unavailable branch." }
    Write-Output "PASS native stderr and exit-code handling. No network calls were made."
} finally { Pop-Location }
