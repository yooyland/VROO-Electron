param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check([string]$Name, [bool]$Passed, [string]$Detail) {
  $checks.Add([pscustomobject]@{
    name = $Name
    passed = $Passed
    detail = $Detail
  })
}

$required = @(
  "AI\MASTER_BIBLE.md",
  "AI\AI_OPERATING_MANUAL.md",
  "AI\AI_ROLES.md",
  "AI\QUALITY_RULES.md",
  "AI\COMPLETION_TREE.md",
  "AI\WORK_QUEUE.md",
  "AI\DECISION_LOG.md",
  "AI\FOUNDATION_STATUS.md",
  "AI\AUTOMATION_CONTRACT.md",
  "AI\WORK_QUEUE_SCHEMA.md"
)

foreach ($item in $required) {
  $path = Join-Path $ProjectRoot $item
  Add-Check "required:$item" (Test-Path $path) $(if (Test-Path $path) { "exists" } else { "missing" })
}

$gitDir = Join-Path $ProjectRoot ".git"
Add-Check "git-repository" (Test-Path $gitDir) $(if (Test-Path $gitDir) { "Git repository detected" } else { "No .git directory" })

$queuePath = Join-Path $ProjectRoot "AI\WORK_QUEUE.md"
if (Test-Path $queuePath) {
  $queueText = Get-Content $queuePath -Raw
  $hasColumns = $queueText -match '\|\s*ID\s*\|\s*Area\s*\|\s*Title\s*\|\s*Status\s*\|\s*Priority\s*\|\s*DependsOn\s*\|\s*Acceptance\s*\|'
  Add-Check "work-queue-columns" $hasColumns $(if ($hasColumns) { "valid header" } else { "required table header not found" })

  $ids = [regex]::Matches($queueText, '(?m)^\|\s*([A-Z][A-Z0-9_-]*-\d{3})\s*\|') | ForEach-Object { $_.Groups[1].Value }
  $duplicates = $ids | Group-Object | Where-Object Count -gt 1 | Select-Object -ExpandProperty Name
  Add-Check "work-queue-unique-ids" ($duplicates.Count -eq 0) $(if ($duplicates.Count -eq 0) { "unique" } else { "duplicates: " + ($duplicates -join ", ") })

  $validStatuses = @("BACKLOG","READY","IN_PROGRESS","REVIEW","APPROVED","DONE","BLOCKED","FAILED","CANCELLED")
  $rows = Get-Content $queuePath | Where-Object { $_ -match '^\|\s*[A-Z][A-Z0-9_-]*-\d{3}\s*\|' }
  $invalid = @()
  foreach ($row in $rows) {
    $cells = $row.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
    if ($cells.Count -ge 4 -and $validStatuses -notcontains $cells[3]) {
      $invalid += "$($cells[0]):$($cells[3])"
    }
  }
  Add-Check "work-queue-status-values" ($invalid.Count -eq 0) $(if ($invalid.Count -eq 0) { "valid" } else { "invalid: " + ($invalid -join ", ") })
}

$packageJson = Join-Path $ProjectRoot "package.json"
if (Test-Path $packageJson) {
  try {
    $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
    Add-Check "package-json" $true "valid JSON"
  } catch {
    Add-Check "package-json" $false $_.Exception.Message
  }
}

$failed = @($checks | Where-Object { -not $_.passed })

if ($Json) {
  [pscustomobject]@{
    passed = ($failed.Count -eq 0)
    failedCount = $failed.Count
    checks = $checks
  } | ConvertTo-Json -Depth 6
} else {
  Write-Host ""
  Write-Host "VROO Foundation Validation" -ForegroundColor Cyan
  Write-Host "Project: $ProjectRoot"
  foreach ($check in $checks) {
    $mark = if ($check.passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($check.passed) { "Green" } else { "Red" }
    Write-Host ("{0} {1} - {2}" -f $mark, $check.name, $check.detail) -ForegroundColor $color
  }
  Write-Host ""
  if ($failed.Count -gt 0) {
    Write-Host "FAILED: $($failed.Count) check(s)" -ForegroundColor Red
  } else {
    Write-Host "PASSED: Foundation v1.0 operational checks" -ForegroundColor Green
  }
}

if ($failed.Count -gt 0) { exit 1 }
