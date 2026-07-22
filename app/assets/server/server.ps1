<#
.SYNOPSIS
  [UNUSED] Legacy local static file server from the pre-Electron Web Prototype.

.NOTES
  VROO Desktop (Electron) does NOT use this script.
  Run the app with: npm start  (or 01_INSTALL_AND_RUN.cmd / 02_RUN_VROO.cmd)
  Kept only for reference. Do not rely on it for normal operation.
#>
param(
    [int]$Port = 8097
)

$ErrorActionPreference = "Stop"

# server.ps1 path (legacy):
# <VROO ROOT>\app\assets\server\server.ps1
$ServerFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$AssetsFolder = Split-Path -Parent $ServerFolder
$Root = Split-Path -Parent $AssetsFolder
$Root = [System.IO.Path]::GetFullPath($Root)

$Prefix = "http://localhost:$Port/"

function Get-MimeType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".js"   { return "text/javascript; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        ".woff" { return "font/woff" }
        ".woff2"{ return "font/woff2" }
        default { return "application/octet-stream" }
    }
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Prefix)

try {
    $Listener.Start()
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  VROO Beta 1.0.7 Server"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "Root: $Root"
    Write-Host "URL : $Prefix"
    Write-Host ""
    Write-Host "Keep this window open while using VROO."
    Write-Host ""

    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        try {
            $RequestPath = [System.Uri]::UnescapeDataString(
                $Context.Request.Url.AbsolutePath.TrimStart("/")
            )

            if ([string]::IsNullOrWhiteSpace($RequestPath)) {
                $RequestPath = "index.html"
            }

            $Candidate = [System.IO.Path]::GetFullPath(
                (Join-Path $Root $RequestPath)
            )

            if (-not $Candidate.StartsWith(
                $Root,
                [System.StringComparison]::OrdinalIgnoreCase
            )) {
                $Context.Response.StatusCode = 403
                $Context.Response.Close()
                continue
            }

            if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
                $Context.Response.StatusCode = 404
                $Context.Response.Close()
                continue
            }

            $Bytes = [System.IO.File]::ReadAllBytes($Candidate)
            $Context.Response.StatusCode = 200
            $Context.Response.ContentType = Get-MimeType $Candidate
            $Context.Response.ContentLength64 = $Bytes.Length
            $Context.Response.Headers["Cache-Control"] = "no-store"
            $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
            $Context.Response.OutputStream.Close()
        }
        catch {
            try {
                $Context.Response.StatusCode = 500
                $Context.Response.Close()
            } catch {}
        }
    }
}
finally {
    if ($Listener.IsListening) {
        $Listener.Stop()
    }
    $Listener.Close()
}
