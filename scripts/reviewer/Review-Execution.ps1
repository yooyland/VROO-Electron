param([string]$ProjectRoot="D:\VROO_Electron")
$ErrorActionPreference="Stop"
Set-Location $ProjectRoot

$currentPath=Join-Path $ProjectRoot "AI\CURRENT_TASK.json"
if(-not(Test-Path $currentPath)){throw "CURRENT_TASK.json not found."}
$current=Get-Content $currentPath -Raw|ConvertFrom-Json
$task=$current.task

$candidates=@(
 "AI\REPO_SEPARATION_RESULT.md",
 "AI\IMPLEMENTATION_RESULT.md",
 "AI\TASK_RESULT.md"
)
$resultPath=$null
foreach($candidate in $candidates){
 if(Test-Path(Join-Path $ProjectRoot $candidate)){$resultPath=$candidate;break}
}

$outcome="NO_EVIDENCE"
$reasons=@()
if($resultPath){
 $content=Get-Content (Join-Path $ProjectRoot $resultPath) -Raw
 $required=@("files","validation","risk")
 $missing=@()
 foreach($term in $required){if($content -notmatch $term){$missing+=$term}}
 if($missing.Count -eq 0){
  $outcome="APPROVED"
  $reasons+="Evidence document contains file, validation, and risk sections."
 }else{
  $outcome="CHANGES_REQUIRED"
  $reasons+="Missing evidence concepts: $($missing -join ', ')"
 }
}else{
 $reasons+="No recognized implementation result document exists."
}

$review=[ordered]@{
 version="1.0";reviewedAt=(Get-Date -Format o);taskId=$task.id
 outcome=$outcome;evidence=$resultPath;reasons=$reasons
}
$review|ConvertTo-Json -Depth 6|Set-Content (Join-Path $ProjectRoot "AI\REVIEW_RESULT.json") -Encoding UTF8

$evidenceText = if ($resultPath) {
    "``$resultPath``"
} else {
    "None"
}

$md=@(
"# REVIEW RESULT","",
"- Task: **$($task.id)**",
"- Outcome: **$outcome**",
"- Evidence: $evidenceText","",
"## Reasons"
)
foreach($r in $reasons){$md+="- $r"}
$md|Set-Content (Join-Path $ProjectRoot "AI\REVIEW_RESULT.md") -Encoding UTF8
Write-Host "Reviewer outcome: $outcome" -ForegroundColor $(if($outcome -eq "APPROVED"){"Green"}else{"Yellow"})

