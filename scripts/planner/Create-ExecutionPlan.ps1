param([string]$ProjectRoot="D:\VROO_Electron")
$ErrorActionPreference="Stop"
Set-Location $ProjectRoot

$brain=Get-Content (Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json") -Raw|ConvertFrom-Json
$graph=Get-Content (Join-Path $ProjectRoot "AI\DEPENDENCY_GRAPH.json") -Raw|ConvertFrom-Json
$currentPath=Join-Path $ProjectRoot "AI\CURRENT_TASK.json"

$selected=$null
$reason=""

if($brain.repository.dirtyCount -gt 0){
 $selected=[pscustomobject]@{
  id="REPO-001";area="Repository";priority="P0"
  title="Split mixed repository changes into coherent commits"
  acceptance="Every changed file is assigned to exactly one reviewed commit group or ambiguity list."
 }
 $reason="Repository safety has precedence because $($brain.repository.dirtyCount) changed entries exist."
}elseif($brain.nextTask){
 $selected=$brain.nextTask
 $reason="Selected from Project Brain."
}else{
 $ready=$graph.nodes|Where-Object executable -eq $true|Sort-Object score|Select-Object -First 1
 if($ready){
  $selected=[pscustomobject]@{
   id=("PLAN-"+$ready.id.ToUpper()+"-001");area=$ready.id;priority="P1"
   title=("Improve "+$ready.id+" operational readiness")
   acceptance=("Raise "+$ready.id+" confidence using validated repository evidence.")
  }
  $reason="Selected lowest-scoring unblocked dependency node."
 }
}
if(-not $selected){throw "Planner found no executable task."}

$plan=[ordered]@{
 version="1.0";generatedAt=(Get-Date -Format o);selectedTask=$selected;reason=$reason
}
$plan|ConvertTo-Json -Depth 8|Set-Content (Join-Path $ProjectRoot "AI\EXECUTION_PLAN.json") -Encoding UTF8

$md=@(
"# VROO EXECUTION PLAN","",
"- Task: **$($selected.id)**",
"- Priority: **$($selected.priority)**",
"- Area: **$($selected.area)**",
"- Title: $($selected.title)",
"- Reason: $reason",
"- Acceptance: $($selected.acceptance)"
)
$md|Set-Content (Join-Path $ProjectRoot "AI\EXECUTION_PLAN.md") -Encoding UTF8
Write-Host "Planner selected: $($selected.id)" -ForegroundColor Cyan
