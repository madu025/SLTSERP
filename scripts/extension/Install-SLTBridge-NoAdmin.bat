@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SLT-ERP Bridge - No-Admin Chrome Extension Installer
:: Extracts extension and auto-loads via --load-extension flag
:: No admin required, no registry, no manual clicks
:: ============================================================

title SLT-ERP Bridge Installer
color 0A

echo.
echo  ============================================
echo   SLT-ERP Bridge - Chrome Extension Installer
echo  ============================================
echo.

:: Set paths
set "EXTENSION_DIR=%LOCALAPPDATA%\SLT-Bridge-Extension"
set "SCRIPT_DIR=%~dp0"
set "ZIP_FILE=%SCRIPT_DIR%slt-bridge.zip"
set "LAUNCHER=%LOCALAPPDATA%\SLT-Bridge-Extension\Start-Chrome-With-Bridge.bat"

:: Check if zip exists
if not exist "%ZIP_FILE%" (
    color 0C
    echo  ERROR: slt-bridge.zip not found!
    echo  Expected at: %ZIP_FILE%
    echo.
    pause
    exit /b 1
)

:: Clean old installation
if exist "%EXTENSION_DIR%" (
    echo  Removing old installation...
    rd /s /q "%EXTENSION_DIR%" 2>nul
)

:: Create extension directory
echo  Installing to: %EXTENSION_DIR%
mkdir "%EXTENSION_DIR%" 2>nul

:: Extract zip
echo  Extracting extension files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTENSION_DIR%' -Force" 2>nul

if not exist "%EXTENSION_DIR%\manifest.json" (
    :: Maybe zip has a subfolder - try to find manifest.json
    for /d %%D in ("%EXTENSION_DIR%\*") do (
        if exist "%%D\manifest.json" (
            xcopy "%%D\*" "%EXTENSION_DIR%\" /s /e /y >nul 2>&1
            rd /s /q "%%D" 2>nul
        )
    )
)

if not exist "%EXTENSION_DIR%\manifest.json" (
    color 0C
    echo  ERROR: Extension extraction failed!
    echo  manifest.json not found in extracted files.
    echo.
    pause
    exit /b 1
)

echo  Extension extracted successfully!
echo.

:: Create Chrome launcher batch file
echo  Creating Chrome launcher...
(
    echo @echo off
    echo :: Start Chrome with SLT-Bridge extension loaded
    echo taskkill /f /im chrome.exe ^>nul 2^>^&1
    echo timeout /t 2 /nobreak ^>nul
    echo start "" "chrome.exe" --load-extension="%EXTENSION_DIR%"
    echo exit
) > "%LAUNCHER%"

echo  Launcher created: %LAUNCHER%
echo.

:: Kill Chrome
echo  Restarting Chrome with extension...
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul

:: Start Chrome with extension loaded
start "" "chrome.exe" --load-extension="%EXTENSION_DIR%"

echo.
echo  ============================================
echo  SUCCESS!
echo  ============================================
echo.
echo  Chrome started with SLT-ERP Bridge extension.
echo.
echo  NOTE: A yellow bar may appear at the top of Chrome.
echo  This is normal. Click "Keep changes" if prompted.
echo.
echo  FROM NOW ON: Use the launcher to start Chrome:
echo  %LAUNCHER%
echo.
echo  Or double-click "Start-Chrome-With-Bridge.bat"
echo  in %EXTENSION_DIR%
echo.
echo  To update: Re-run this installer.
echo.
pause
