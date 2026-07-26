param([string]$ProjectRoot="D:\VROO_Electron")
$ErrorActionPreference="Stop"
$brainPath=Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json"
$queuePath=Join-Path $ProjectRoot "AI\WORK_QUEUE.md"
if(-not(Test-Path $brainPath)){& (Join-Path $PSScriptRoot "Scan-ProjectBrain.ps1") -ProjectRoot $ProjectRoot}
$brain=Get-Content $brainPath -Raw|ConvertFrom-Json
if(-not $brain.nextTask){Write-Host "No candidate task." -ForegroundColor Yellow;exit 0}
$id=$brain.nextTask.id
$current=if(Test-Path $queuePath){Get-Content $queuePath -Raw}else{""}
if($current -match "(?m)^\|\s*$([regex]::Escape($id))\s*\|"){Write-Host "$id already exists." -ForegroundColor Yellow;exit 0}
$row="| $id | $($brain.nextTask.area) | $($brain.nextTask.title) | READY | $($brain.nextTask.priority) | - | $($brain.nextTask.acceptance) |"
Add-Content $queuePath $row -Encoding UTF8
Write-Host "$id added to AI\WORK_QUEUE.md." -ForegroundColor Green
