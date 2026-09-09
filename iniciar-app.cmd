@echo off
REM Doble clic para levantar la aplicacion en http://localhost:5173
REM (agrega las herramientas portables al PATH de esta ventana)
set "PATH=%USERPROFILE%\dev-tools\node;%USERPROFILE%\dev-tools\npm-global;%PATH%"
cd /d "%~dp0"
echo Iniciando servidor de desarrollo...  (Ctrl+C para detener)
call pnpm --filter @rat/web dev
pause
