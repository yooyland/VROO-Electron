$ErrorActionPreference = "Stop"

Write-Host "=== VROO AI CHECK ===" -ForegroundColor Cyan

if (-not (Test-Path "package.json")) {
  Write-Host "No package.json found. Repository audit only." -ForegroundColor Yellow
  git status --short
  exit 0
}

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
$scripts = @{}
if ($package.scripts) {
  $package.scripts.psobject.Properties | ForEach-Object { $scripts[$_.Name] = $_.Value }
}

$commands = @("lint", "typecheck", "test", "build")
$failed = $false

foreach ($name in $commands) {
  if ($scripts.ContainsKey($name)) {
    Write-Host "`n--- npm run $name ---" -ForegroundColor Cyan
    if ($name -eq "test") {
      npm run $name -- --runInBand
    } else {
      npm run $name
    }
    if ($LASTEXITCODE -ne 0) { $failed = $true; break }
  } else {
    Write-Host "Skipping '$name' (script not defined)." -ForegroundColor DarkGray
  }
}

Write-Host "`n--- git diff --check ---" -ForegroundColor Cyan
git diff --check
if ($LASTEXITCODE -ne 0) { $failed = $true }

if ($failed) {
  Write-Error "VROO verification failed."
  exit 1
}

Write-Host "`nVROO verification passed." -ForegroundColor Green
