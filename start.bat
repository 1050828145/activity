@echo off
setlocal
cd /d "%~dp0"

set "NODE_HOME=D:\environments\node-v22.20.0\node-v22.20.0-win-x64"
set "PORT=5173"
set "TITLE=MiaodaVite-%PORT%"

if not exist "%NODE_HOME%\node.exe" (
  echo [ERROR] Node.js not found: %NODE_HOME%
  pause
  exit /b 1
)

echo [1/3] Cleaning port %PORT% ...
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr "LISTENING" ^| findstr ":%PORT% "') do (
  echo       Killing old process PID %%p
  taskkill /F /T /PID %%p >nul 2>&1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [2/3] Installing dependencies, please wait ...
  set "PATH=%NODE_HOME%;%PATH%"
  call "%NODE_HOME%\npm.cmd" install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
) else (
  echo [2/3] Dependencies OK
)

echo [3/3] Starting Vite dev server ...
set "PATH=%NODE_HOME%;%PATH%"
start "%TITLE%" cmd /k "cd /d %~dp0 && node node_modules\vite\bin\vite.js --host 127.0.0.1 --port %PORT% --config vite.config.ts"

echo.
echo Dev server is starting in a new window.
echo URL: http://127.0.0.1:%PORT%/
echo Close that window or run stop.bat to stop it.
ping -n 5 127.0.0.1 >nul
exit /b 0
