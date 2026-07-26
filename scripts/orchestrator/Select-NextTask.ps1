param(
  [string]$ProjectRoot = "D:\VROO_Electron"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$brainPath = Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json"
$queuePath = Join-Path $ProjectRoot "AI\WORK_QUEUE.md"
$policyPath = Join-Path $ProjectRoot "AI\orchestrator\ORCHESTRATOR_POLICY.json"

if (-not (Test-Path $brainPath)) {
  throw "AI\PROJECT_BRAIN.json not found. Run Project Brain scan first."
}
if (-not (Test-Path $policyPath)) {
  throw "Orchestrator policy not found."
}

$brain = Get-Content $brainPath -Raw | ConvertFrom-Json
$policy = Get-Content $policyPath -Raw | ConvertFrom-Json

function Parse-Queue([string]$Path) {
  $rows = @()
  if (-not (Test-Path $Path)) { return $rows }

  foreach ($line in Get-Content $Path) {
    if ($line -match '^\|\s*([A-Z][A-Z0-9_-]*-\d{3})\s*\|') {
      $cells = $line.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
      if ($cells.Count -ge 7) {
        $rows += [pscustomobject]@{
          id=$cells[0]; area=$cells[1]; title=$cells[2]; status=$cells[3]
          priority=$cells[4]; dependsOn=$cells[5]
          acceptance=($cells[6..($cells.Count-1)] -join " | ")
        }
      }
    }
  }
  return $rows
}

$queue = Parse-Queue $queuePath
$active = @($queue | Where-Object status -eq "ACTIVE")
if ($active.Count -gt 1) {
  throw "Multiple ACTIVE tasks detected. Resolve Work Queue before continuing."
}

$selected = $null
$reason = ""

# Repository safety always wins.
if ($brain.repository.dirtyCount -gt 0) {
  $repoTask = $queue | Where-Object id -eq "REPO-001" | Select-Object -First 1
  if ($repoTask -and $repoTask.status -notin @("DONE","APPROVED")) {
    $selected = $repoTask
    $reason = "Repository contains $($brain.repository.dirtyCount) changed entries."
  }
  elseif (-not $repoTask) {
    $selected = [pscustomobject]@{
      id="REPO-001"
      area="Repository"
      title="Split mixed repository changes into coherent commits"
      status="READY"
      priority="P0"
      dependsOn="-"
      acceptance="Every remaining change is assigned to a coherent commit group; no file is lost."
    }
    $reason = "Repository contains $($brain.repository.dirtyCount) changed entries and REPO-001 was not in the queue."
  }
}

if (-not $selected -and $active.Count -eq 1) {
  $selected = $active[0]
  $reason = "An ACTIVE task already exists."
}

if (-not $selected -and $brain.nextTask) {
  $selected = $brain.nextTask
  $reason = "Selected from Project Brain recommendation."
}

if (-not $selected) {
  $rank = @{P0=0;P1=1;P2=2;P3=3}
  $selected = $queue |
    Where-Object status -in @("READY","PLANNED","TODO") |
    Sort-Object @{Expression={$rank[$_.priority]}}, id |
    Select-Object -First 1
  if ($selected) { $reason = "Selected from Work Queue priority." }
}

if (-not $selected) {
  throw "No executable task found."
}

$currentTask = [ordered]@{
  version="1.0"
  generatedAt=(Get-Date -Format o)
  task=[ordered]@{
    id=$selected.id
    area=$selected.area
    title=$selected.title
    status=$selected.status
    priority=$selected.priority
    dependsOn=$selected.dependsOn
    acceptance=$selected.acceptance
  }
  selectionReason=$reason
  repository=[ordered]@{
    branch=$brain.repository.branch
    head=$brain.repository.head
    dirtyCount=$brain.repository.dirtyCount
  }
}

$currentTask | ConvertTo-Json -Depth 8 |
  Set-Content (Join-Path $ProjectRoot "AI\CURRENT_TASK.json") -Encoding UTF8

Write-Host ""
Write-Host "Selected task: $($selected.id)" -ForegroundColor Cyan
Write-Host "$($selected.title)"
Write-Host "Reason: $reason"
