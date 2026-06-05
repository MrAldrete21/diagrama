# Launcher MOVIL de Diagrama: asegura el dev server y abre la version movil
# (?view=mobile) en una ventana standalone tamano telefono (Chrome/Edge --app).
$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
$base = 'http://localhost:5173'
$url = "$base/?view=mobile"

function Test-Up {
  try { return (Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
  catch { return $false }
}

# Arranca el dev server solo si no esta ya corriendo, y espera a que responda.
if (-not (Test-Up)) {
  Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" `
    -ArgumentList 'run', 'dev' -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
  for ($i = 0; $i -lt 60; $i++) { if (Test-Up) { break }; Start-Sleep -Milliseconds 500 }
}

# Detecta el browser instalado.
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

# Ventana standalone tamano telefono. user-data-dir propio (DiagramaMobile) para
# que abra SIEMPRE su propia ventana, independiente de la app desktop.
if ($browser) {
  $dataDir = Join-Path $env:LOCALAPPDATA 'DiagramaMobile'
  Start-Process -FilePath $browser -ArgumentList @(
    "--app=$url",
    "--user-data-dir=$dataDir",
    "--window-size=420,900",
    "--no-first-run",
    "--no-default-browser-check"
  )
} else {
  Start-Process $url
}
