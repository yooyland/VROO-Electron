$ErrorActionPreference = "Stop"
$Target = "D:\VROO_Electron\Character"

Write-Host "VROO Character 폴더 확인: $Target"
if (-not (Test-Path $Target)) {
  New-Item -ItemType Directory -Path $Target | Out-Null
}

Write-Host "구조가 준비되었습니다."
Write-Host "테스트 파일: $Target\Integration\examples\garage-character-demo.html"
