@echo off
rem Launcher web de Diagrama: delega en diagrama-web.ps1 (arranca el dev server
rem si hace falta y abre la app en ventana standalone Chrome/Edge --app).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagrama-web.ps1"
