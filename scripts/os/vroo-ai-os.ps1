param(
 [Parameter(Position=0)]
 [ValidateSet("cycle","prepare","review","status","memory","dependencies","plan","help")]
 [string]$Command="help",
 [string]$ProjectRoot="D:\VROO_Electron"
)

$ErrorActionPreference="Stop"

function Require([string]$Path,[string]$Name){
 if(-not(Test-Path $Path)){throw "$Name is not installed: $Path"}
}

$brain=Join-Path $ProjectRoot "scripts\brain\vroo-brain.ps1"
$orchestrator=Join-Path $ProjectRoot "scripts\orchestrator\vroo-orchestrator.ps1"
$memory=Join-Path $ProjectRoot "scripts\memory\Update-ProjectMemory.ps1"
$dependency=Join-Path $ProjectRoot "scripts\dependency\Build-DependencyGraph.ps1"
$planner=Join-Path $ProjectRoot "scripts\planner\Create-ExecutionPlan.ps1"
$reviewer=Join-Path $ProjectRoot "scripts\reviewer\Review-Execution.ps1"

switch($Command){
 "cycle"{
  Require $brain "Project Brain"
  Require $orchestrator "Orchestrator"
  & $brain scan -ProjectRoot $ProjectRoot
  & $memory -ProjectRoot $ProjectRoot
  & $dependency -ProjectRoot $ProjectRoot
  & $planner -ProjectRoot $ProjectRoot
  & $orchestrator prepare -ProjectRoot $ProjectRoot
  Write-Host ""
  Write-Host "VROO AI Development OS cycle prepared." -ForegroundColor Green
  Write-Host "Next: open AI\CURSOR_TASK_INSTRUCTION.md in Cursor."
 }
 "prepare"{
  & $memory -ProjectRoot $ProjectRoot
  & $dependency -ProjectRoot $ProjectRoot
  & $planner -ProjectRoot $ProjectRoot
  & $orchestrator prepare -ProjectRoot $ProjectRoot
 }
 "review"{
  & $reviewer -ProjectRoot $ProjectRoot
  & $brain scan -ProjectRoot $ProjectRoot
  & $memory -ProjectRoot $ProjectRoot
 }
 "status"{
  $files=@(
   "AI\PROJECT_DASHBOARD.md","AI\PROJECT_MEMORY_REPORT.md",
   "AI\DEPENDENCY_GRAPH.md","AI\EXECUTION_PLAN.md",
   "AI\ORCHESTRATOR_REPORT.md","AI\REVIEW_RESULT.md"
  )
  foreach($f in $files){
   $full=Join-Path $ProjectRoot $f
   Write-Host ""
   Write-Host "===== $f =====" -ForegroundColor Cyan
   if(Test-Path $full){Get-Content $full}else{Write-Host "Not generated."}
  }
 }
 "memory"{& $memory -ProjectRoot $ProjectRoot}
 "dependencies"{& $dependency -ProjectRoot $ProjectRoot}
 "plan"{& $planner -ProjectRoot $ProjectRoot}
 default{
  Write-Host @"
VROO AI Development Operating System v1.0

Commands:
  cycle         Full preparation cycle
  prepare       Update engines and prepare task
  review        Review implementation evidence
  status        Show OS reports
  memory        Update memory only
  dependencies  Build dependency graph only
  plan          Create execution plan only
"@
 }
}
