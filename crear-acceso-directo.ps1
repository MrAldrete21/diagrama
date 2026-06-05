# Crea un acceso directo en el escritorio que abre Diagrama como app
# standalone (ventana sin barra de browser) via Chrome/Edge en modo --app.
#
# Uso:
#   .\crear-acceso-directo.ps1 -Url "https://tu-deploy.netlify.app"
#   .\crear-acceso-directo.ps1 -Url "http://localhost:4173" -Name "Diagrama local"
#
# Una vez deployada la PWA (Netlify/Vercel), el modo --app + service worker
# da una experiencia casi nativa: ventana propia, offline, instalable.

param(
  [Parameter(Mandatory = $true)]
  [string]$Url,
  [string]$Name = "Diagrama"
)

$browsers = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  Write-Error "No se encontro Chrome ni Edge. Instala uno o edita el script."
  exit 1
}

$icon = Join-Path $PSScriptRoot "public\icon.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "$Name.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $browser
$lnk.Arguments = "--app=$Url"
if (Test-Path $icon) { $lnk.IconLocation = $icon }
$lnk.Description = "Diagrama (PWA)"
$lnk.Save()

Write-Host "Acceso directo creado: $lnkPath"
Write-Host "Browser: $browser"
Write-Host "URL: $Url"
