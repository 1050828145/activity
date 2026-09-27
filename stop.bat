@echo off
setlocal
set "PORT=5173"

echo Stopping Vite dev server on port %PORT% ...

set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr "LISTENING" ^| findstr ":%PORT% "') do (
  echo       Killing PID %%p
  taskkill /F /T /PID %%p >nul 2>&1
  set "FOUND=1"
)

if not defined FOUND (
  echo No process is listening on port %PORT%.
)

echo Done.
ping -n 3 127.0.0.1 >nul
exit /b 0
