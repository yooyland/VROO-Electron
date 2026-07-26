param(
  [string]$TaskId,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

if (-not (Test-Path ".git")) { throw "Not a Git repository: $ProjectRoot" }

$status = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "git status failed" }
if ($status) {
  Write-Host "Working tree is not clean. Commit, stash, or separate existing work first." -ForegroundColor Red
  git status --short
  exit 2
}

$tasks = & (Join-Path $PSScriptRoot "Get-WorkQueue.ps1") -ProjectRoot $ProjectRoot
if (-not $TaskId) {
  $priorityOrder = @{ P0=0; P1=1; P2=2; P3=3 }
  $task = $tasks | Where-Object Status -eq "READY" | Sort-Object @{Expression={ $priorityOrder[$_.Priority] }}, ID | Select-Object -First 1
} else {
  $task = $tasks | Where-Object ID -eq $TaskId | Select-Object -First 1
}

if (-not $task) { throw "No matching READY task found." }
if ($task.Status -ne "READY") { throw "Task $($task.ID) is $($task.Status), not READY." }

$slug = ($task.Title.ToLowerInvariant() -replace '[^a-z0-9]+','-').Trim('-')
if (-not $slug) { $slug = "task" }
$branch = "ai/$($task.ID.ToLowerInvariant())-$slug"

$current = git branch --show-current
if ($current -notin @("main","master","develop")) {
  throw "Start from main, master, or develop. Current branch: $current"
}

git checkout -b $branch
if ($LASTEXITCODE -ne 0) { throw "Could not create branch $branch" }

& (Join-Path $PSScriptRoot "Set-TaskStatus.ps1") -TaskId $task.ID -Status IN_PROGRESS -ProjectRoot $ProjectRoot

$taskFile = Join-Path $ProjectRoot "AI\CURRENT_TASK.md"
@"
# CURRENT TASK

- ID: $($task.ID)
- Area: $($task.Area)
- Title: $($task.Title)
- Priority: $($task.Priority)
- Depends on: $($task.DependsOn)
- Branch: $branch
- Acceptance: $($task.Acceptance)
- Started: $(Get-Date -Format o)

## Required reading

1. AI/MASTER_BIBLE.md
2. AI/AUTOMATION_CONTRACT.md
3. AI/QUALITY_RULES.md
4. AI/AI_OPERATING_MANUAL.md
5. AI/CURRENT_TASK.md

## Completion rule

Do not mark complete until validation passes and a report exists.
"@ | Set-Content -Path $taskFile -Encoding UTF8

git add AI/WORK_QUEUE.md AI/CURRENT_TASK.md
git commit -m "chore(ai): start $($task.ID)"
if ($LASTEXITCODE -ne 0) { throw "Failed to create task-start commit" }

Write-Host ""
Write-Host "Task started: $($task.ID) - $($task.Title)" -ForegroundColor Green
Write-Host "Branch: $branch"
Write-Host "Implementation may now be done with any editor or AI tool."
