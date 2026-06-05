@echo off
title Diagrama
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs\;%PATH%"
npm run dev -- --open
