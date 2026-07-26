param([string]$ProjectRoot="D:\VROO_Electron")
$ErrorActionPreference="Stop"
Set-Location $ProjectRoot

$rules=Get-Content (Join-Path $ProjectRoot "AI\dependency\DEPENDENCY_RULES.json") -Raw|ConvertFrom-Json
$brain=Get-Content (Join-Path $ProjectRoot "AI\PROJECT_BRAIN.json") -Raw|ConvertFrom-Json

$nodes=@()
foreach($rule in $rules.nodes){
  $area=$brain.areas|Where-Object id -eq $rule.id|Select-Object -First 1
  $score=if($area){$area.score}else{0}
  $blocked=@()
  foreach($dep in $rule.dependsOn){
    $depArea=$brain.areas|Where-Object id -eq $dep|Select-Object -First 1
    if($depArea -and $depArea.score -lt 70){$blocked+=$dep}
  }
  $nodes+=[pscustomobject]@{
    id=$rule.id
    dependsOn=@($rule.dependsOn)
    score=$score
    blockedBy=$blocked
    executable=($blocked.Count -eq 0)
  }
}

$graph=[ordered]@{
 version="1.0";generatedAt=(Get-Date -Format o);nodes=$nodes
}
$graph|ConvertTo-Json -Depth 8|Set-Content (Join-Path $ProjectRoot "AI\DEPENDENCY_GRAPH.json") -Encoding UTF8

$md=@("# VROO DEPENDENCY GRAPH","")
foreach($n in $nodes){
 $state=if($n.executable){"READY"}else{"BLOCKED"}
 $deps=if($n.dependsOn.Count){$n.dependsOn -join ", "}else{"-"}
 $blocks=if($n.blockedBy.Count){$n.blockedBy -join ", "}else{"-"}
 $md+="- **$($n.id)** · $state · score $($n.score)% · depends: $deps · blocked by: $blocks"
}
$md|Set-Content (Join-Path $ProjectRoot "AI\DEPENDENCY_GRAPH.md") -Encoding UTF8
Write-Host "Dependency graph generated." -ForegroundColor Green
