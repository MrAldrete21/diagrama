# Launcher web de Diagrama: asegura el dev server y abre la app en una ventana
# standalone (Chrome/Edge en modo --app, sin barra de browser).
$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
$url = 'http://localhost:5173'

function Test-Up {
  try { return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
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

# Abre la app en ventana standalone. Usa un user-data-dir dedicado para que
# SIEMPRE abra su propia ventana de app (independiente del Chrome del usuario)
# en vez de delegar en una instancia ya abierta.
if ($browser) {
  $dataDir = Join-Path $env:LOCALAPPDATA 'DiagramaApp'
  Start-Process -FilePath $browser -ArgumentList @(
    "--app=$url",
    "--user-data-dir=$dataDir",
    "--no-first-run",
    "--no-default-browser-check"
  )
} else {
  Start-Process $url
}
