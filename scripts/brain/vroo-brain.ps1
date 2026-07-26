param(
 [Parameter(Position=0)][ValidateSet("scan","status","next","plan","sync-queue","help")]
 [string]$Command="help",
 [string]$ProjectRoot="D:\VROO_Electron"
)
switch($Command){
 "scan"{& (Join-Path $PSScriptRoot "Scan-ProjectBrain.ps1") -ProjectRoot $ProjectRoot}
 "status"{if(-not(Test-Path(Join-Path $ProjectRoot "AI\PROJECT_DASHBOARD.md"))){& (Join-Path $PSScriptRoot "Scan-ProjectBrain.ps1") -ProjectRoot $ProjectRoot};Get-Content(Join-Path $ProjectRoot "AI\PROJECT_DASHBOARD.md")}
 "next"{if(-not(Test-Path(Join-Path $ProjectRoot "AI\NEXT_ACTION.md"))){& (Join-Path $PSScriptRoot "Scan-ProjectBrain.ps1") -ProjectRoot $ProjectRoot};Get-Content(Join-Path $ProjectRoot "AI\NEXT_ACTION.md")}
 "plan"{if(-not(Test-Path(Join-Path $ProjectRoot "AI\REPOSITORY_COMMIT_PLAN.md"))){& (Join-Path $PSScriptRoot "Scan-ProjectBrain.ps1") -ProjectRoot $ProjectRoot};Get-Content(Join-Path $ProjectRoot "AI\REPOSITORY_COMMIT_PLAN.md")}
 "sync-queue"{& (Join-Path $PSScriptRoot "Sync-BrainQueue.ps1") -ProjectRoot $ProjectRoot}
 default{Write-Host "Commands: scan, status, next, plan, sync-queue"}
}
