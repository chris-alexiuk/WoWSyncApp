[CmdletBinding()]
param(
  [string]$Repo = "chris-alexiuk/WoWSyncApp",
  [string]$Version,
  [string]$Tag,
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$CreateReleaseIfMissing,
  [string]$ReleaseTarget = "development"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command {
  param([string]$CommandName)

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing required command: '$CommandName'."
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description
  )

  Write-Step $Description
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed (exit code $LASTEXITCODE)."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Require-Command "bun"
Require-Command "gh"
Require-Command "git"

$packageJsonPath = Join-Path $repoRoot "package.json"
if (-not (Test-Path $packageJsonPath)) {
  throw "package.json not found at: $packageJsonPath"
}

$package = Get-Content -Raw -Path $packageJsonPath | ConvertFrom-Json

if (-not $Version) {
  $Version = [string]$package.version
}

if (-not $Version) {
  throw "Could not determine app version."
}

if (-not $Tag) {
  $Tag = "v$Version"
}

Write-Step "Preparing Windows updater assets for $Tag ($Version)"

if (-not $SkipInstall) {
  Invoke-Checked -FilePath "bun" -Arguments @("install") -Description "Installing dependencies"
}

if (-not $SkipBuild) {
  Invoke-Checked -FilePath "bun" -Arguments @("run", "dist:win:installer") -Description "Building Windows NSIS installer"
}

$releaseDir = Join-Path $repoRoot "release"
$latestYmlPath = Join-Path $releaseDir "latest.yml"

if (-not (Test-Path $latestYmlPath)) {
  throw "Missing updater metadata file: $latestYmlPath"
}

$pathLine = Get-Content -Path $latestYmlPath |
  Where-Object { $_ -match '^\s*path\s*:' } |
  Select-Object -First 1

if (-not $pathLine) {
  throw "Unable to parse installer filename from latest.yml path field."
}

$expectedInstallerName = ($pathLine -replace '^\s*path\s*:\s*', '').Trim().Trim("'`"")
if (-not $expectedInstallerName) {
  throw "Parsed installer filename from latest.yml path field is empty."
}

$expectedInstallerPath = Join-Path $releaseDir $expectedInstallerName

if (-not (Test-Path $expectedInstallerPath)) {
  Write-Step "Installer '$expectedInstallerName' not found; creating file with expected name."

  $candidateInstaller = Get-ChildItem -Path $releaseDir -File |
    Where-Object { $_.Name -match "$([regex]::Escape($Version)).*win.*x64.*\.exe$" } |
    Sort-Object -Property Length, LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $candidateInstaller) {
    throw "Could not find a Windows installer .exe for version $Version in $releaseDir"
  }

  Copy-Item -Path $candidateInstaller.FullName -Destination $expectedInstallerPath -Force
}

$installerBlockmapPath = "$expectedInstallerPath.blockmap"

& gh release view $Tag --repo $Repo *> $null
$releaseExists = $LASTEXITCODE -eq 0

if (-not $releaseExists) {
  if (-not $CreateReleaseIfMissing) {
    throw "Release $Tag does not exist in $Repo. Create it first or pass -CreateReleaseIfMissing."
  }

  Invoke-Checked `
    -FilePath "gh" `
    -Arguments @(
      "release",
      "create",
      $Tag,
      "--repo",
      $Repo,
      "--target",
      $ReleaseTarget,
      "--title",
      "AzerSync $Tag",
      "--notes",
      "Automated release bootstrap from release-windows-updater.ps1"
    ) `
    -Description "Creating release $Tag"
}

$uploadArgs = @(
  "release",
  "upload",
  $Tag,
  $expectedInstallerPath,
  $latestYmlPath,
  "--repo",
  $Repo,
  "--clobber"
)

if (Test-Path $installerBlockmapPath) {
  $uploadArgs += $installerBlockmapPath
}

Invoke-Checked -FilePath "gh" -Arguments $uploadArgs -Description "Uploading Windows updater assets"

Write-Step "Validating release assets"
$releaseJsonRaw = & gh release view $Tag --repo $Repo --json assets,url,tagName
if ($LASTEXITCODE -ne 0) {
  throw "Failed to fetch release metadata for validation."
}

$releaseJson = $releaseJsonRaw | ConvertFrom-Json
$assetNames = @($releaseJson.assets | ForEach-Object { $_.name })

if (-not ($assetNames -contains (Split-Path -Leaf $expectedInstallerPath))) {
  throw "Installer asset is missing after upload."
}

if (-not ($assetNames -contains "latest.yml")) {
  throw "latest.yml is missing after upload."
}

Write-Host ""
Write-Host "Release updated successfully." -ForegroundColor Green
Write-Host "Release URL: $($releaseJson.url)"
Write-Host "Installer: $(Split-Path -Leaf $expectedInstallerPath)"
Write-Host "Metadata: latest.yml"
