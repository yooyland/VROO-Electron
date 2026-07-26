param(
  [Parameter(Position=0)]
  [ValidateSet("prepare","select","instruction","show","verify","help")]
  [string]$Command = "help",
  [string]$ProjectRoot = "D:\VROO_Electron"
)

switch ($Command) {
  "prepare" {
    $brainCli = Join-Path $ProjectRoot "scripts\brain\vroo-brain.ps1"
    if (-not (Test-Path $brainCli)) {
      throw "Project Brain is not installed."
    }
    & $brainCli scan -ProjectRoot $ProjectRoot
    & (Join-Path $PSScriptRoot "Select-NextTask.ps1") -ProjectRoot $ProjectRoot
    & (Join-Path $PSScriptRoot "Generate-ExecutionPackage.ps1") -ProjectRoot $ProjectRoot
  }
  "select" {
    & (Join-Path $PSScriptRoot "Select-NextTask.ps1") -ProjectRoot $ProjectRoot
  }
  "instruction" {
    & (Join-Path $PSScriptRoot "Generate-ExecutionPackage.ps1") -ProjectRoot $ProjectRoot
  }
  "show" {
    Get-Content (Join-Path $ProjectRoot "AI\CURSOR_TASK_INSTRUCTION.md")
  }
  "verify" {
    $result = Join-Path $ProjectRoot "AI\REPO_SEPARATION_RESULT.md"
    if (Test-Path $result) {
      Write-Host "Execution result document found." -ForegroundColor Green
    } else {
      Write-Host "Execution result document not found yet." -ForegroundColor Yellow
    }
    & (Join-Path $ProjectRoot "scripts\brain\vroo-brain.ps1") scan -ProjectRoot $ProjectRoot
  }
  default {
    Write-Host @"
VROO AI Orchestrator v1.0

Commands:
  prepare      Scan, select, and generate instructions
  select       Select next task
  instruction  Generate Cursor task package
  show         Display Cursor instruction
  verify       Check result and rescan Brain
"@
  }
}
