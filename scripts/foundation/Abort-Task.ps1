param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

Set-Location $ProjectRoot
& (Join-Path $PSScriptRoot "Set-TaskStatus.ps1") -TaskId $TaskId -Status FAILED -ProjectRoot $ProjectRoot
if (Test-Path "AI\CURRENT_TASK.md") { Remove-Item "AI\CURRENT_TASK.md" }
git add AI/WORK_QUEUE.md AI/CURRENT_TASK.md 2>$null
git commit -m "chore(ai): mark $TaskId failed" 2>$null
Write-Host "$TaskId marked FAILED. Existing implementation changes were not deleted." -ForegroundColor Yellow
