@echo off
REM ASCII-only. Verify entry: free WSL VM memory, wait for Docker, then ONE install hop.
REM Customer path remains Install-Mesa.ps1 (this file is verify-only).
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo  Mesa on-prem CLEAN + INSTALL (WSL)
echo ========================================
echo.
echo This will:
echo   A. wsl --shutdown  ^(return WSL2 VM memory to Windows^)
echo   B. Wait until Ubuntu + Docker respond again
echo   C. ONE Ubuntu session: clean + copy + bootstrap + up + migrate
echo.
echo Web image: default UP without --build ^(faster, less RAM^).
echo Force rebuild: create empty file FORCE-WEB-BUILD.txt in this folder, or set MESA_VERIFY_BUILD=1
echo.
echo Pack root: %CD%
echo.

if not exist "%~dp0deploy\on-prem\scripts\verify-install-wsl.sh" (
  echo ERROR: deploy\on-prem\scripts\verify-install-wsl.sh missing.
  echo Extract the whole zip, then double-click START-WSL-TEST.cmd inside it.
  echo.
  pause
  exit /b 1
)

where wsl >nul 2>&1
if errorlevel 1 (
  echo ERROR: wsl not found. Install WSL2 Ubuntu first: wsl --install -d Ubuntu
  echo.
  pause
  exit /b 1
)

echo === A/C  Free WSL VM memory ===
echo Shutting down all WSL distros ^(Docker Desktop will restart its backend^)...
wsl --shutdown
echo Waiting 20s for shutdown to settle...
timeout /t 20 /nobreak >nul

echo.
echo === B/C  Wait for Ubuntu + Docker ===
echo Keep Docker Desktop open until it shows Ready.
echo Probing up to ~3 minutes...
set /a READY=0
set /a N=0
:wait_docker
set /a N+=1
if %N% gtr 60 goto wait_docker_fail
wsl -d Ubuntu -- docker info >nul 2>&1
if not errorlevel 1 (
  set /a READY=1
  goto wait_docker_done
)
timeout /t 3 /nobreak >nul
goto wait_docker

:wait_docker_fail
echo.
echo ERROR: Ubuntu/Docker did not come back after wsl --shutdown.
echo   1. Open Docker Desktop, wait until Ready
echo   2. Settings -^> Resources -^> WSL Integration -^> enable Ubuntu
echo   3. PowerShell: wsl -d Ubuntu -- docker info
echo   4. Double-click this script again
echo.
pause
exit /b 1

:wait_docker_done
echo Docker OK inside Ubuntu.
echo.

set "VERIFY_BUILD=0"
if /I "%MESA_VERIFY_BUILD%"=="1" set "VERIFY_BUILD=1"
if exist "%~dp0FORCE-WEB-BUILD.txt" set "VERIFY_BUILD=1"
if "%VERIFY_BUILD%"=="1" (
  echo Web: FORCE rebuild enabled ^(MESA_VERIFY_BUILD or FORCE-WEB-BUILD.txt^)
) else (
  echo Web: up without --build ^(default^)
)
echo.

echo === C/C  ONE install session ===
echo.

REM Single long hop only. Build flag passed as 2nd arg to verify script.
wsl -d Ubuntu --cd "%CD%" -- bash ./deploy/on-prem/scripts/verify-install-wsl.sh . %VERIFY_BUILD%
set ERR=%ERRORLEVEL%

echo.
if %ERR% equ 0 (
  echo OK - open http://127.0.0.1:3000/setup in Windows browser
  echo Then install Print Agent with server http://127.0.0.1:3000
  echo.
  pause
  exit /b 0
)

if %ERR% equ -1 goto wsl_host_fail
if %ERR% equ 4294967295 goto wsl_host_fail

echo FAILED exit=%ERR% ^(Mesa/verify script or Docker inside Ubuntu^)
echo If Docker is the issue: Desktop Ready + WSL Integration -^> enable Ubuntu
echo.
pause
exit /b %ERR%

:wsl_host_fail
echo FAILED: Windows WSL host connection error ^(exit=%ERR%^)
echo This is NOT a Mesa migrate failure - the long Ubuntu session dropped.
echo Retry: leave Docker Desktop Ready, double-click again ^(script will wsl --shutdown first^).
echo.
pause
exit /b 1
