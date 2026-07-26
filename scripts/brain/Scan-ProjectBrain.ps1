param(
  [string]$ProjectRoot = "D:\VROO_Electron"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

function Normalize-PathText([string]$PathText) {
  return ($PathText -replace '\\','/').Trim()
}

function Test-RepoPath([string]$RelativePath) {
  return Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)
}

function Get-TrackedFiles {
  $output = & git ls-files 2>$null
  if ($LASTEXITCODE -ne 0) { throw "git ls-files failed." }
  return @($output | ForEach-Object { Normalize-PathText $_ })
}

function Get-StatusEntries {
  $lines = @(& git status --porcelain=v1 -uall 2>$null)
  if ($LASTEXITCODE -ne 0) { throw "git status failed." }

  $entries = @()
  foreach ($line in $lines) {
    if ($line.Length -lt 4) { continue }
    $code = $line.Substring(0,2)
    $path = $line.Substring(3)
    if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
    $entries += [pscustomobject]@{
      code = $code
      path = Normalize-PathText $path
      staged = ($code[0] -ne ' ' -and $code[0] -ne '?')
      unstaged = ($code[1] -ne ' ')
      untracked = ($code -eq '??')
      deleted = ($code -match 'D')
    }
  }
  return $entries
}

function Get-AreaForPath([string]$Path) {
  $p = Normalize-PathText $Path
  if ($p -like "AI/*" -or $p -like "scripts/foundation/*" -or $p -like "scripts/brain/*" -or $p -like ".github/workflows/*") { return "Foundation" }
  if ($p -like "Character/*" -or $p -like "app/assets/characters/*" -or $p -eq "scripts/sync-characters.js") { return "Character System" }
  if ($p -like "*garage*" -or $p -like "app/assets/js/modules/my/*") { return "Garage" }
  if ($p -like "app/assets/js/modules/*chat*" -or $p -eq "app/assets/js/modules/conversation-store.js") { return "Chat" }
  if ($p -eq "app/assets/js/modules/profile.js") { return "Profile / My Page" }
  if ($p -like "docs/*") { return "Architecture" }
  if ($p -like "*firebase*" -or $p -eq "app/assets/js/core/storage.js") { return "Firebase / Data" }
  if ($p -eq "app/index.html" -or $p -eq "app/assets/js/app.js" -or $p -like "app/assets/css/*") { return "Core UI" }
  if ($p -eq "package.json") { return "Build / Delivery" }
  if ($p -like ".cursor/*" -or $p -like "CURSOR_*" -or $p -like "START_CURSOR_*") { return "Cursor Rules" }
  return "Repository"
}

function Parse-WorkQueue([string]$QueuePath) {
  $rows = @()
  if (-not (Test-Path $QueuePath)) { return $rows }
  foreach ($line in Get-Content $QueuePath) {
    if ($line -match '^\|\s*([A-Z][A-Z0-9_-]*-\d{3})\s*\|') {
      $cells = $line.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
      if ($cells.Count -ge 7) {
        $rows += [pscustomobject]@{
          id=$cells[0]; area=$cells[1]; title=$cells[2]; status=$cells[3];
          priority=$cells[4]; dependsOn=$cells[5]; acceptance=($cells[6..($cells.Count-1)] -join " | ")
        }
      }
    }
  }
  return $rows
}

$areasConfig = Get-Content (Join-Path $ProjectRoot "AI\brain\AREAS.json") -Raw | ConvertFrom-Json
$catalog = Get-Content (Join-Path $ProjectRoot "AI\brain\TASK_CATALOG.json") -Raw | ConvertFrom-Json
$tracked = Get-TrackedFiles
$status = Get-StatusEntries
$queue = Parse-WorkQueue (Join-Path $ProjectRoot "AI\WORK_QUEUE.md")

$branch = (& git branch --show-current 2>$null).Trim()
$head = (& git rev-parse --short HEAD 2>$null).Trim()

$areaResults = @()
foreach ($area in $areasConfig.areas) {
  $requiredPresent = @()
  $requiredMissing = @()
  foreach ($signal in $area.required_signals) {
    if (Test-RepoPath $signal) { $requiredPresent += $signal } else { $requiredMissing += $signal }
  }

  $signalScore = if ($area.required_signals.Count -gt 0) {
    [math]::Round(($requiredPresent.Count / [double]$area.required_signals.Count) * 100)
  } else { 0 }

  $areaChanges = @($status | Where-Object { (Get-AreaForPath $_.path) -eq $area.name })
  $areaTracked = @($tracked | Where-Object {
    $candidate = $_
    foreach ($signal in $area.required_signals) {
      $n = Normalize-PathText $signal
      if ($candidate -eq $n -or $candidate.StartsWith("$n/")) { return $true }
    }
    return $false
  })

  $integrationScore = if ($requiredPresent.Count -eq 0) { 0 } else {
    [math]::Round([math]::Min(100, ($areaTracked.Count / [double]$requiredPresent.Count) * 100))
  }

  $areaTasks = @($queue | Where-Object area -eq $area.name)
  $doneTasks = @($areaTasks | Where-Object status -in @("DONE","APPROVED"))
  $queueScore = if ($areaTasks.Count -gt 0) {
    [math]::Round(($doneTasks.Count / [double]$areaTasks.Count) * 100)
  } else { 50 }

  $riskScore = 100
  if (@($areaChanges | Where-Object untracked).Count -gt 0) { $riskScore -= 25 }
  if (@($areaChanges | Where-Object deleted).Count -gt 0) { $riskScore -= 35 }
  if ($areaChanges.Count -gt 5) { $riskScore -= 15 }
  if ($riskScore -lt 0) { $riskScore = 0 }

  $score = [math]::Round(($signalScore*0.35)+($integrationScore*0.25)+($queueScore*0.20)+($riskScore*0.20))

  $areaResults += [pscustomobject]@{
    id=$area.id; name=$area.name; weight=$area.weight; score=$score
    signalScore=$signalScore; integrationScore=$integrationScore
    queueScore=$queueScore; riskReadiness=$riskScore
    requiredPresent=$requiredPresent; requiredMissing=$requiredMissing
    changedFiles=$areaChanges
    changeCount=$areaChanges.Count
    untrackedCount=@($areaChanges | Where-Object untracked).Count
    deletedCount=@($areaChanges | Where-Object deleted).Count
  }
}

$groupedChanges = @()
foreach ($group in ($status | Group-Object { Get-AreaForPath $_.path } | Sort-Object Name)) {
  $groupedChanges += [pscustomobject]@{
    area=$group.Name
    count=$group.Count
    files=@($group.Group)
    suggestedCommit = switch ($group.Name) {
      "Foundation" { "feat(ai): upgrade project brain and foundation operations" }
      "Architecture" { "docs(architecture): establish VROO system documentation" }
      "Character System" { "feat(characters): add character source and runtime assets" }
      "Garage" { "feat(garage): implement garage and my-page modules" }
      "Chat" { "feat(chat): improve conversation and road chat behavior" }
      "Profile / My Page" { "feat(profile): reorganize profile and my-page experience" }
      "Core UI" { "feat(ui): refine core application interface" }
      "Firebase / Data" { "feat(data): update storage and firebase model" }
      "Build / Delivery" { "chore(build): update package and delivery configuration" }
      "Cursor Rules" { "chore(cursor): update VROO development rules" }
      default { "chore(repo): organize remaining repository changes" }
    }
  }
}

$risks = @()
if ($status.Count -gt 0) {
  $risks += [pscustomobject]@{severity="HIGH"; id="DIRTY_WORKTREE"; message="$($status.Count) changed file entries remain."}
}
if ($branch -like "foundation/*" -and @($status | Where-Object { (Get-AreaForPath $_.path) -notin @("Foundation","Cursor Rules") }).Count -gt 0) {
  $risks += [pscustomobject]@{severity="HIGH"; id="MIXED_FOUNDATION_BRANCH"; message="Application changes are mixed into a Foundation branch."}
}
if (@($status | Where-Object deleted).Count -gt 0) {
  $risks += [pscustomobject]@{severity="HIGH"; id="DELETED_FILES"; message="Deleted files require explicit review before commit."}
}
if (@($status | Where-Object untracked).Count -gt 20) {
  $risks += [pscustomobject]@{severity="MEDIUM"; id="LARGE_UNTRACKED_SET"; message="Large untracked file set should be separated by domain."}
}

$priorityRank = @{P0=0;P1=1;P2=2;P3=3}
$candidates = @()
foreach ($task in $catalog.tasks) {
  $include = $false
  switch ($task.id) {
    "REPO-001" { $include = ($status.Count -gt 0) }
    "FOUNDATION-002" { $include = (($areaResults | Where-Object id -eq "foundation").score -lt 90) }
    "ARCH-001" { $include = (($areaResults | Where-Object id -eq "architecture").untrackedCount -gt 0) }
    "CHAR-001" { $include = (($areaResults | Where-Object id -eq "character").changeCount -gt 0) }
    "GARAGE-001" { $include = (($areaResults | Where-Object id -eq "garage").changeCount -gt 0) }
    "CHAT-001" { $include = (($areaResults | Where-Object id -eq "chat").changeCount -gt 0) }
    "PROFILE-001" { $include = (($areaResults | Where-Object id -eq "profile").changeCount -gt 0) }
    "UI-001" { $include = (($areaResults | Where-Object id -eq "ui").changeCount -gt 0) }
  }
  if ($include -and -not ($queue | Where-Object id -eq $task.id)) { $candidates += $task }
}
$nextTask = $candidates | Sort-Object @{Expression={$priorityRank[$_.priority]}}, id | Select-Object -First 1

$totalWeight = ($areaResults | Measure-Object weight -Sum).Sum
$overall = if ($totalWeight -gt 0) {
  [math]::Round((($areaResults | ForEach-Object {$_.score*$_.weight} | Measure-Object -Sum).Sum)/$totalWeight)
} else { 0 }

$brain = [ordered]@{
  version="2.0"; generatedAt=(Get-Date -Format o)
  repository=[ordered]@{
    root=$ProjectRoot; branch=$branch; head=$head; dirtyCount=$status.Count
    trackedFileCount=$tracked.Count; status=$status; changeGroups=$groupedChanges
  }
  overallProgress=$overall; areas=$areaResults; risks=$risks
  workQueue=[ordered]@{total=$queue.Count; items=$queue}
  candidates=$candidates; nextTask=$nextTask
}

$brain | ConvertTo-Json -Depth 15 | Set-Content (Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json") -Encoding UTF8

$dashboard = @()
$dashboard += "# VROO PROJECT DASHBOARD v2.0"
$dashboard += ""
$dashboard += "- Generated: $($brain.generatedAt)"
$dashboard += "- Branch: ``$branch``"
$dashboard += "- HEAD: ``$head``"
$dashboard += "- Overall operational confidence: **$overall%**"
$dashboard += "- Changed entries: **$($status.Count)**"
$dashboard += "- Tracked files: **$($tracked.Count)**"
$dashboard += ""
$dashboard += "## Area status"
$dashboard += ""
$dashboard += "| Area | Score | Signals | Git integration | Queue | Risk readiness | Changes |"
$dashboard += "|---|---:|---:|---:|---:|---:|---:|"
foreach ($a in $areaResults | Sort-Object score) {
  $dashboard += "| $($a.name) | $($a.score)% | $($a.signalScore)% | $($a.integrationScore)% | $($a.queueScore)% | $($a.riskReadiness)% | $($a.changeCount) |"
}
$dashboard += ""
$dashboard += "## Repository change groups"
$dashboard += ""
foreach ($g in $groupedChanges) {
  $dashboard += "### $($g.area) — $($g.count) files"
  $dashboard += ""
  $dashboard += "Suggested commit: ``$($g.suggestedCommit)``"
  $dashboard += ""
  foreach ($f in $g.files) { $dashboard += "- ``$($f.code)`` ``$($f.path)``" }
  $dashboard += ""
}
$dashboard += "## Risks"
$dashboard += ""
if ($risks.Count -eq 0) { $dashboard += "- No active risk detected." }
else { foreach ($r in $risks) { $dashboard += "- **$($r.severity)** ``$($r.id)`` — $($r.message)" } }
$dashboard += ""
$dashboard += "## Recommended next task"
$dashboard += ""
if ($nextTask) {
  $dashboard += "- **$($nextTask.id)** · $($nextTask.priority)"
  $dashboard += "- $($nextTask.title)"
  $dashboard += "- Acceptance: $($nextTask.acceptance)"
} else { $dashboard += "- No new candidate; review current Work Queue." }

$dashboardPath = Join-Path $ProjectRoot "AI\PROJECT_DASHBOARD.md"
$dashboard | Set-Content $dashboardPath -Encoding UTF8

$plan = @()
$plan += "# REPOSITORY COMMIT PLAN"
$plan += ""
$plan += "Generated by Project Brain v2.0. Review before staging."
$plan += ""
$i=1
foreach ($g in $groupedChanges) {
  $plan += "## Commit $i — $($g.area)"
  $plan += ""
  $plan += "Message: ``$($g.suggestedCommit)``"
  $plan += ""
  $plan += "Files:"
  foreach ($f in $g.files) { $plan += "- ``$($f.path)``" }
  $plan += ""
  $i++
}
$plan | Set-Content (Join-Path $ProjectRoot "AI\REPOSITORY_COMMIT_PLAN.md") -Encoding UTF8

$next = @("# NEXT ACTION","")
if ($nextTask) {
  $next += "- Task: **$($nextTask.id)**"
  $next += "- Priority: **$($nextTask.priority)**"
  $next += "- Title: $($nextTask.title)"
  $next += "- Acceptance: $($nextTask.acceptance)"
  $next += ""
  $next += "Review ``AI\REPOSITORY_COMMIT_PLAN.md`` before changing Git state."
} else { $next += "No candidate generated." }
$next | Set-Content (Join-Path $ProjectRoot "AI\NEXT_ACTION.md") -Encoding UTF8

$reportDir = Join-Path $ProjectRoot "AI\reports"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $dashboardPath (Join-Path $reportDir "BRAIN_V2_SCAN_$stamp.md") -Force

Write-Host ""
Write-Host "VROO Project Brain v2.0 scan complete." -ForegroundColor Green
Write-Host "Overall confidence: $overall%"
Write-Host "Changed entries: $($status.Count)"
if ($nextTask) { Write-Host "Next task: $($nextTask.id) - $($nextTask.title)" -ForegroundColor Cyan }
Write-Host ""
Write-Host "Dashboard: AI\PROJECT_DASHBOARD.md"
Write-Host "Commit plan: AI\REPOSITORY_COMMIT_PLAN.md"
Write-Host "Brain data: AI\PROJECT_BRAIN.json"
