param(
  [Parameter(Position=0)][ValidateSet("status","start","validate","finish","abort","queue","help")][string]$Command = "help",
  [Parameter(Position=1)][string]$TaskId,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

switch ($Command) {
  "status" {
    Write-Host "Project: $ProjectRoot" -ForegroundColor Cyan
    Write-Host "Branch: $(git -C $ProjectRoot branch --show-current)"
    git -C $ProjectRoot status --short
    & (Join-Path $PSScriptRoot "Validate-Foundation.ps1") -ProjectRoot $ProjectRoot
  }
  "start" {
    & (Join-Path $PSScriptRoot "Start-Task.ps1") -TaskId $TaskId -ProjectRoot $ProjectRoot
  }
  "validate" {
    & (Join-Path $PSScriptRoot "Validate-Foundation.ps1") -ProjectRoot $ProjectRoot
  }
  "finish" {
    if (-not $TaskId) { throw "Task ID required. Example: finish UI-004" }
    & (Join-Path $PSScriptRoot "Finish-Task.ps1") -TaskId $TaskId -ProjectRoot $ProjectRoot
  }
  "abort" {
    if (-not $TaskId) { throw "Task ID required. Example: abort UI-004" }
    & (Join-Path $PSScriptRoot "Abort-Task.ps1") -TaskId $TaskId -ProjectRoot $ProjectRoot
  }
  "queue" {
    & (Join-Path $PSScriptRoot "Get-WorkQueue.ps1") -ProjectRoot $ProjectRoot | Format-Table -AutoSize
  }
  default {
    Write-Host @"
VROO Foundation v1.0

Commands:
  status
  queue
  start [TASK-ID]
  validate
  finish TASK-ID
  abort TASK-ID

Examples:
  .\scripts\foundation\vroo-foundation.ps1 status
  .\scripts\foundation\vroo-foundation.ps1 start UI-004
"@
  }
}
