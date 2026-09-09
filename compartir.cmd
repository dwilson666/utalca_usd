@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  Publica la aplicacion en un enlace HTTPS temporal para revision.
REM  El enlace funciona SOLO mientras esta ventana este abierta y este PC
REM  encendido. Cada vez que lo ejecutes genera un enlace NUEVO.
REM  Para un enlace permanente -> Cloudflare Pages (ver docs/PUESTA_EN_MARCHA.md).
REM ─────────────────────────────────────────────────────────────────────
setlocal
set "PATH=%USERPROFILE%\dev-tools\node;%USERPROFILE%\dev-tools\npm-global;%PATH%"
set "CF=%USERPROFILE%\dev-tools\cloudflared.exe"
cd /d "%~dp0"

echo [1/3] Compilando la aplicacion...
call pnpm --filter @rat/web build || (echo ERROR al compilar & pause & exit /b 1)

echo [2/3] Iniciando servidor local (puerto 4173)...
start "RAT - servidor" /min cmd /c "pnpm --filter @rat/web preview"
timeout /t 4 /nobreak >nul

echo [3/3] Abriendo enlace publico...  (Ctrl+C aqui para cerrar todo)
echo.
echo   ================================================================
echo   Copia el enlace https://XXXX.trycloudflare.com que aparece abajo
echo   y envialo. Credenciales de revision:
echo     alejandro.olea@utalca.cl  /  talca2026
echo   ================================================================
echo.
"%CF%" tunnel --url http://localhost:4173 --no-autoupdate
