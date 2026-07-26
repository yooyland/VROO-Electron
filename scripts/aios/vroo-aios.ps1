param(
  [Parameter(Position=0)]
  [ValidateSet("intake","status","help")]
  [string]$Command = "help",
  [string]$ProjectRoot = "D:\VROO_Electron",
  [string]$BackupRoot = "D:\VROO_Backups"
)

switch ($Command) {
  "intake" {
    & (Join-Path $PSScriptRoot "Invoke-RepositoryIntake.ps1") `
      -ProjectRoot $ProjectRoot `
      -BackupRoot $BackupRoot
  }
  "status" {
    Write-Host "VROO AIOS status" -ForegroundColor Cyan
    Write-Host "Project: $ProjectRoot"
    git -C $ProjectRoot branch --show-current
    git -C $ProjectRoot status --short
    if (Test-Path (Join-Path $ProjectRoot "scripts\foundation\Validate-Foundation.ps1")) {
      & (Join-Path $ProjectRoot "scripts\foundation\Validate-Foundation.ps1") -ProjectRoot $ProjectRoot
    }
  }
  default {
    Write-Host @"
VROO AIOS v1.0 Phase 1

Commands:
  intake   Back up and separate Foundation files
  status   Show repository and Foundation status

Examples:
  .\scripts\aios\vroo-aios.ps1 intake
  .\scripts\aios\vroo-aios.ps1 status
"@
  }
}
