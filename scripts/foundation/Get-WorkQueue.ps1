param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$queuePath = Join-Path $ProjectRoot "AI\WORK_QUEUE.md"
if (-not (Test-Path $queuePath)) {
  throw "Missing AI\WORK_QUEUE.md"
}

$tasks = @()
Get-Content $queuePath | ForEach-Object {
  if ($_ -match '^\|\s*([A-Z][A-Z0-9_-]*-\d{3})\s*\|') {
    $cells = $_.Trim('|').Split('|') | ForEach-Object { $_.Trim() }
    if ($cells.Count -ge 7) {
      $tasks += [pscustomobject]@{
        ID = $cells[0]
        Area = $cells[1]
        Title = $cells[2]
        Status = $cells[3]
        Priority = $cells[4]
        DependsOn = $cells[5]
        Acceptance = ($cells[6..($cells.Count-1)] -join " | ")
      }
    }
  }
}

$tasks
