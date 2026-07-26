param([string]$ProjectRoot="D:\VROO_Electron")
$ErrorActionPreference="Stop"
Set-Location $ProjectRoot

$memoryPath=Join-Path $ProjectRoot "AI\memory\PROJECT_MEMORY.json"
if(-not(Test-Path $memoryPath)){throw "PROJECT_MEMORY.json not found."}
$memory=Get-Content $memoryPath -Raw|ConvertFrom-Json
if($null -eq $memory.entries){$memory|Add-Member -NotePropertyName entries -NotePropertyValue @()}

$sources=@(
  @{path="AI\DECISION_LOG.md";type="decision";title="Decision Log"},
  @{path="docs\ARCHITECTURE_BIBLE.md";type="architecture";title="Architecture Bible"},
  @{path="docs\VROO_PROJECT_STATE.md";type="milestone";title="Project State"},
  @{path="AI\FOUNDATION_STATUS.md";type="milestone";title="Foundation Status"},
  @{path="AI\NEXT_ACTION.md";type="milestone";title="Next Action"}
)

foreach($src in $sources){
  $full=Join-Path $ProjectRoot $src.path
  if(Test-Path $full){
    $hash=(Get-FileHash $full -Algorithm SHA256).Hash
    $existing=@($memory.entries|Where-Object source -eq $src.path|Select-Object -First 1)
    $summary=((Get-Content $full -TotalCount 20) -join "`n")
    $entry=[pscustomobject]@{
      id=("MEM-"+$hash.Substring(0,12))
      type=$src.type
      title=$src.title
      summary=$summary
      source=$src.path
      sourceHash=$hash
      createdAt=(Get-Date -Format o)
      status="ACTIVE"
    }
    if($existing.Count -eq 0){
      $memory.entries+= $entry
    }elseif($existing[0].sourceHash -ne $hash){
      $memory.entries=@($memory.entries|Where-Object source -ne $src.path)
      $memory.entries+= $entry
    }
  }
}
$memory.updatedAt=(Get-Date -Format o)
$memory|ConvertTo-Json -Depth 8|Set-Content $memoryPath -Encoding UTF8

$report=@(
"# PROJECT MEMORY REPORT","",
"- Updated: $($memory.updatedAt)",
"- Entries: $($memory.entries.Count)","",
"## Active memory"
)
foreach($e in $memory.entries){$report+="- **$($e.type)** · $($e.title) · ``$($e.source)``"}
$report|Set-Content (Join-Path $ProjectRoot "AI\PROJECT_MEMORY_REPORT.md") -Encoding UTF8
Write-Host "Memory Engine updated: $($memory.entries.Count) entries" -ForegroundColor Green
