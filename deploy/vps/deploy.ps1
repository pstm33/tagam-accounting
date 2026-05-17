[CmdletBinding()]
param(
  [string]$BundlePath = "",
  [switch]$Upload,
  [string]$VpsHost = $env:VPS_HOST,
  [string]$VpsUser = $env:VPS_USER,
  [int]$VpsPort = $(if ($env:VPS_PORT) { [int]$env:VPS_PORT } else { 22 }),
  [string]$RemotePath = $(if ($env:VPS_REMOTE_PATH) { $env:VPS_REMOTE_PATH } else { "/tmp/tagam-accounting-release.zip" })
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$deployDir = Join-Path $repoRoot ".deploy"
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

if (-not $BundlePath) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $BundlePath = Join-Path $deployDir "tagam-accounting-$stamp.zip"
}

$status = git -C $repoRoot status --short
if ($status) {
  Write-Warning "Repository has uncommitted changes. The archive uses HEAD only."
  $status | ForEach-Object { Write-Warning $_ }
}

git -C $repoRoot archive --format=zip --output $BundlePath HEAD
Write-Host "Created bundle: $BundlePath"

if ($Upload) {
  if (-not $VpsHost -or -not $VpsUser) {
    throw "VPS_HOST and VPS_USER are required for upload."
  }

  $target = "${VpsUser}@${VpsHost}:${RemotePath}"
  scp -P $VpsPort $BundlePath $target
  scp -P $VpsPort (Join-Path $PSScriptRoot "install.sh") "${VpsUser}@${VpsHost}:/tmp/tagam-accounting-install.sh"
  Write-Host "Uploaded bundle to: $target"
  Write-Host "On the VPS, run:"
  Write-Host "  sudo bash /tmp/tagam-accounting-install.sh $RemotePath"
}
