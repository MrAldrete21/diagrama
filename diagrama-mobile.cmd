@echo off
rem Launcher movil de Diagrama: delega en diagrama-mobile.ps1 (arranca el dev
rem server si hace falta y abre la version movil en ventana standalone tamano
rem telefono Chrome/Edge --app, con ?view=mobile).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagrama-mobile.ps1"
