param(
  [string]$ProjectRoot = "D:\VROO_Electron"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$currentPath = Join-Path $ProjectRoot "AI\CURRENT_TASK.json"
$brainPath = Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json"

if (-not (Test-Path $currentPath)) {
  & (Join-Path $PSScriptRoot "Select-NextTask.ps1") -ProjectRoot $ProjectRoot
}

$current = Get-Content $currentPath -Raw | ConvertFrom-Json
$brain = Get-Content $brainPath -Raw | ConvertFrom-Json
$task = $current.task

$relatedGroup = $brain.repository.changeGroups |
  Where-Object area -eq $task.area |
  Select-Object -First 1

$files = @()
if ($task.id -eq "REPO-001") {
  foreach ($group in $brain.repository.changeGroups) {
    foreach ($file in $group.files) {
      $files += $file.path
    }
  }
}
elseif ($relatedGroup) {
  $files = @($relatedGroup.files | ForEach-Object { $_.path })
}

$instruction = New-Object System.Collections.Generic.List[string]
$instruction.Add("# CURSOR TASK INSTRUCTION")
$instruction.Add("")
$instruction.Add("## Task")
$instruction.Add("")
$instruction.Add("- ID: **$($task.id)**")
$instruction.Add("- Area: **$($task.area)**")
$instruction.Add("- Priority: **$($task.priority)**")
$instruction.Add("- Title: **$($task.title)**")
$instruction.Add("")
$instruction.Add("## Objective")
$instruction.Add("")
$instruction.Add($task.acceptance)
$instruction.Add("")
$instruction.Add("## Repository state")
$instruction.Add("")
$instruction.Add("- Branch: ``$($current.repository.branch)``")
$instruction.Add("- HEAD: ``$($current.repository.head)``")
$instruction.Add("- Changed entries: **$($current.repository.dirtyCount)**")
$instruction.Add("")
$instruction.Add("## Mandatory constraints")
$instruction.Add("")
$instruction.Add("1. Do not delete or reset existing user work.")
$instruction.Add("2. Do not run ``git reset --hard`` or ``git clean -fd``.")
$instruction.Add("3. Do not force-push or merge.")
$instruction.Add("4. Do not modify unrelated areas.")
$instruction.Add("5. Preserve Korean text encoding as UTF-8.")
$instruction.Add("6. Report every changed file.")
$instruction.Add("7. Stop if a destructive or ambiguous decision is required.")
$instruction.Add("")

if ($task.id -eq "REPO-001") {
  $instruction.Add("## Required work")
  $instruction.Add("")
  $instruction.Add("Analyze ``AI\REPOSITORY_COMMIT_PLAN.md`` and the current Git working tree.")
  $instruction.Add("")
  $instruction.Add("Prepare a safe separation plan only. Do not commit automatically.")
  $instruction.Add("")
  $instruction.Add("Create ``AI\REPO_SEPARATION_RESULT.md`` containing:")
  $instruction.Add("")
  $instruction.Add("- each proposed commit group")
  $instruction.Add("- exact files in each group")
  $instruction.Add("- files that appear duplicated, generated, obsolete, or ambiguous")
  $instruction.Add("- recommended branch strategy")
  $instruction.Add("- recommended commit order")
  $instruction.Add("- verification commands")
  $instruction.Add("")
  $instruction.Add("The first commit group must contain only AI Foundation, Project Brain, and Orchestrator files.")
}
else {
  $instruction.Add("## Related files")
  $instruction.Add("")
  if ($files.Count -eq 0) {
    $instruction.Add("- Determine the minimum relevant file set before editing.")
  } else {
    foreach ($file in $files | Sort-Object -Unique) {
      $instruction.Add("- ``$file``")
    }
  }
}
$instruction.Add("")
$instruction.Add("## Completion report")
$instruction.Add("")
$instruction.Add("At the end, provide:")
$instruction.Add("")
$instruction.Add("- work completed")
$instruction.Add("- files changed")
$instruction.Add("- tests or checks run")
$instruction.Add("- unresolved risks")
$instruction.Add("- whether acceptance criteria were met")

$instructionPath = Join-Path $ProjectRoot "AI\CURSOR_TASK_INSTRUCTION.md"
$instruction | Set-Content $instructionPath -Encoding UTF8

$validation = New-Object System.Collections.Generic.List[string]
$validation.Add("# VALIDATION PLAN")
$validation.Add("")
$validation.Add("- Task: **$($task.id)**")
$validation.Add("- Acceptance: $($task.acceptance)")
$validation.Add("")
$validation.Add("## Required checks")
$validation.Add("")
$validation.Add("1. ``git status --short``")
$validation.Add("2. Confirm no unrelated file was modified.")
$validation.Add("3. Confirm no tracked user file was deleted unintentionally.")
$validation.Add("4. Confirm generated documentation exists and is UTF-8 readable.")
$validation.Add("5. Run Project Brain scan again.")
$validation.Add("6. Compare task acceptance criteria with evidence.")
$validation.Add("")
if ($task.id -eq "REPO-001") {
  $validation.Add("## REPO-001 specific checks")
  $validation.Add("")
  $validation.Add("- ``AI\REPO_SEPARATION_RESULT.md`` exists.")
  $validation.Add("- Every changed file appears in exactly one proposed group or in an ambiguity section.")
  $validation.Add("- No commit, reset, clean, deletion, or force action was performed.")
  $validation.Add("- Foundation-related files are isolated from application files.")
}

$validation | Set-Content (Join-Path $ProjectRoot "AI\VALIDATION_PLAN.md") -Encoding UTF8

$report = @(
  "# ORCHESTRATOR REPORT",
  "",
  "- Generated: $(Get-Date -Format o)",
  "- Selected task: **$($task.id)**",
  "- Selection reason: $($current.selectionReason)",
  "- Cursor instruction: ``AI\CURSOR_TASK_INSTRUCTION.md``",
  "- Validation plan: ``AI\VALIDATION_PLAN.md``",
  "",
  "Status: **READY FOR EXECUTION**"
)
$report | Set-Content (Join-Path $ProjectRoot "AI\ORCHESTRATOR_REPORT.md") -Encoding UTF8

Write-Host ""
Write-Host "Execution package generated." -ForegroundColor Green
Write-Host "Cursor instruction: AI\CURSOR_TASK_INSTRUCTION.md"
Write-Host "Validation plan: AI\VALIDATION_PLAN.md"
