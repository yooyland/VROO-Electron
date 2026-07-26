param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

& (Join-Path $PSScriptRoot "Validate-Foundation.ps1") -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw "Validation failed" }

$tasks = & (Join-Path $PSScriptRoot "Get-WorkQueue.ps1") -ProjectRoot $ProjectRoot
$task = $tasks | Where-Object ID -eq $TaskId | Select-Object -First 1
if (-not $task) { throw "Task not found: $TaskId" }
if ($task.Status -ne "IN_PROGRESS") { throw "Task must be IN_PROGRESS. Current: $($task.Status)" }

$reportDir = Join-Path $ProjectRoot "AI\reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$reportPath = Join-Path $reportDir "$TaskId.md"

$changed = git diff --name-only HEAD
$summary = git diff --stat HEAD

@"
# TASK REPORT: $TaskId

- Title: $($task.Title)
- Status: REVIEW
- Completed validation: $(Get-Date -Format o)
- Branch: $(git branch --show-current)

## Acceptance criterion

$($task.Acceptance)

## Changed files

$(if ($changed) { ($changed | ForEach-Object { "- $_" }) -join "`n" } else { "- No uncommitted file changes detected" })

## Diff summary

```
$summary
```

## Reviewer checklist

- [ ] Acceptance criterion verified
- [ ] UI behavior checked where applicable
- [ ] No unintended regression
- [ ] Quality rules satisfied
- [ ] Owner approval obtained before merge
"@ | Set-Content -Path $reportPath -Encoding UTF8

& (Join-Path $PSScriptRoot "Set-TaskStatus.ps1") -TaskId $TaskId -Status REVIEW -ProjectRoot $ProjectRoot

if (Test-Path (Join-Path $ProjectRoot "AI\CURRENT_TASK.md")) {
  Remove-Item (Join-Path $ProjectRoot "AI\CURRENT_TASK.md")
}

git add -A
git commit -m "chore(ai): submit $TaskId for review"
if ($LASTEXITCODE -ne 0) { throw "Commit failed. Review git status." }

Write-Host ""
Write-Host "$TaskId is now in REVIEW." -ForegroundColor Green
Write-Host "Report: AI\reports\$TaskId.md"
Write-Host "Do not merge until owner approval."
