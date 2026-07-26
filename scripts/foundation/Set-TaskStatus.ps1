param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [Parameter(Mandatory=$true)][ValidateSet("BACKLOG","READY","IN_PROGRESS","REVIEW","APPROVED","DONE","BLOCKED","FAILED","CANCELLED")][string]$Status,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$queuePath = Join-Path $ProjectRoot "AI\WORK_QUEUE.md"
$lines = Get-Content $queuePath
$found = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "^\|\s*$([regex]::Escape($TaskId))\s*\|") {
    $cells = $lines[$i].Trim('|').Split('|') | ForEach-Object { $_.Trim() }
    if ($cells.Count -lt 7) { throw "Malformed task row: $TaskId" }
    $cells[3] = $Status
    $lines[$i] = "| " + ($cells -join " | ") + " |"
    $found = $true
    break
  }
}

if (-not $found) { throw "Task not found: $TaskId" }
Set-Content -Path $queuePath -Value $lines -Encoding UTF8
Write-Host "$TaskId -> $Status" -ForegroundColor Cyan
