param(
  [string]$ProjectRoot = "D:\VROO_Electron",
  [string]$BackupRoot = "D:\VROO_Backups",
  [switch]$SkipFoundationCommit
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

if (-not (Test-Path $ProjectRoot)) {
  throw "Project root does not exist: $ProjectRoot"
}
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
  throw "Not a Git repository: $ProjectRoot"
}

Set-Location $ProjectRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $BackupRoot "VROO-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Step "Capture repository metadata"
$currentBranch = (git branch --show-current).Trim()
$currentHead = (git rev-parse HEAD).Trim()
$remote = (git remote -v 2>$null | Out-String).Trim()
$statusLines = @(git status --short)

@"
timestamp=$timestamp
project=$ProjectRoot
branch=$currentBranch
head=$currentHead

remotes:
$remote
"@ | Set-Content (Join-Path $backupDir "repository-info.txt") -Encoding UTF8

$statusLines | Set-Content (Join-Path $backupDir "git-status.txt") -Encoding UTF8
git diff | Set-Content (Join-Path $backupDir "tracked-working-tree.patch") -Encoding UTF8
git diff --cached | Set-Content (Join-Path $backupDir "staged.patch") -Encoding UTF8

Write-Step "Back up untracked files"
$untracked = @(git ls-files --others --exclude-standard)
$untracked | Set-Content (Join-Path $backupDir "untracked-files.txt") -Encoding UTF8

$untrackedCopy = Join-Path $backupDir "untracked"
New-Item -ItemType Directory -Force -Path $untrackedCopy | Out-Null

foreach ($relative in $untracked) {
  $source = Join-Path $ProjectRoot $relative
  if (Test-Path $source -PathType Leaf) {
    $destination = Join-Path $untrackedCopy $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item $source $destination -Force
  }
}

$zipPath = Join-Path $backupDir "untracked-files.zip"
if (Test-Path $untrackedCopy) {
  Compress-Archive -Path (Join-Path $untrackedCopy "*") -DestinationPath $zipPath -Force -ErrorAction SilentlyContinue
}

Write-Step "Create repository intake report"
$groups = [ordered]@{
  "Foundation" = @()
  "Application" = @()
  "Character and assets" = @()
  "Documentation" = @()
  "Cursor rules" = @()
  "GitHub automation" = @()
  "Install packages or temporary material" = @()
  "Other" = @()
}

foreach ($line in $statusLines) {
  if ($line.Length -lt 4) { continue }
  $path = $line.Substring(3).Trim()
  switch -Regex ($path) {
    '^(AI/|scripts/foundation/)' { $groups["Foundation"] += $line; break }
    '^app/' { $groups["Application"] += $line; break }
    '^(Character/|app/assets/characters/)' { $groups["Character and assets"] += $line; break }
    '^docs/' { $groups["Documentation"] += $line; break }
    '^\.cursor/' { $groups["Cursor rules"] += $line; break }
    '^\.github/' { $groups["GitHub automation"] += $line; break }
    '^(VROO_AI_|CURSOR_INSTALL_PROMPT|START_CURSOR_AGENT)' { $groups["Install packages or temporary material"] += $line; break }
    default { $groups["Other"] += $line }
  }
}

$reportDir = Join-Path $ProjectRoot "AI\reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportPath = Join-Path $reportDir "REPOSITORY_INTAKE_$timestamp.md"

$report = New-Object System.Collections.Generic.List[string]
$report.Add("# VROO Repository Intake")
$report.Add("")
$report.Add("- Timestamp: $timestamp")
$report.Add("- Original branch: $currentBranch")
$report.Add("- Original HEAD: $currentHead")
$report.Add("- Backup: $backupDir")
$report.Add("- Policy: no reset, no deletion, no forced checkout")
$report.Add("")

foreach ($name in $groups.Keys) {
  $report.Add("## $name")
  $report.Add("")
  if ($groups[$name].Count -eq 0) {
    $report.Add("- None")
  } else {
    foreach ($entry in $groups[$name]) {
      $report.Add("- ``$entry``")
    }
  }
  $report.Add("")
}

$report.Add("## Recommended commit sequence")
$report.Add("")
$report.Add("1. Foundation and AIOS operating files")
$report.Add("2. Architecture and project documentation")
$report.Add("3. Cursor rules, only after conflict review")
$report.Add("4. Application source changes by functional area")
$report.Add("5. Character and visual assets")
$report.Add("6. Exclude installer copies and temporary bootstrap folders")
$report.Add("")
$report.Add("## Safety result")
$report.Add("")
$report.Add("- [x] Tracked diff backed up")
$report.Add("- [x] Untracked file list backed up")
$report.Add("- [x] Untracked files copied outside repository")
$report.Add("- [ ] Remaining changes reviewed and split")
$report.Add("- [ ] Main branch protected")
$report.Add("- [ ] First VROO task started through Work Queue")

$report | Set-Content $reportPath -Encoding UTF8

if (-not $SkipFoundationCommit) {
  Write-Step "Create Foundation operational branch"
  $branchName = "foundation/v1.0-operational-$timestamp"
  git checkout -b $branchName
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create branch: $branchName"
  }

  $foundationPaths = @(
    ".gitignore",
    "AI",
    "scripts/foundation",
    "scripts/aios",
    ".github/ISSUE_TEMPLATE",
    ".github/workflows/foundation-check.yml",
    ".github/workflows/ai-company-check.yml",
    ".github/pull_request_template_foundation.md"
  )

  foreach ($path in $foundationPaths) {
    if (Test-Path (Join-Path $ProjectRoot $path)) {
      git add -- $path
    }
  }

  git add -- $reportPath
  $staged = @(git diff --cached --name-only)
  if ($staged.Count -eq 0) {
    Write-Host "No Foundation files were staged. Branch was created without a commit." -ForegroundColor Yellow
  } else {
    git commit -m "feat(ai): establish VROO AI Company Foundation v1.0"
    if ($LASTEXITCODE -ne 0) {
      throw "Foundation commit failed. Backup is safe at $backupDir"
    }
    Write-Host "Foundation commit created." -ForegroundColor Green
  }
}

Write-Step "Result"
Write-Host "Backup: $backupDir" -ForegroundColor Green
Write-Host "Report: $reportPath" -ForegroundColor Green
Write-Host "Current branch: $(git branch --show-current)"
Write-Host ""
Write-Host "Remaining uncommitted changes were preserved:" -ForegroundColor Yellow
git status --short
Write-Host ""
Write-Host "Next: review the intake report before splitting application changes."
