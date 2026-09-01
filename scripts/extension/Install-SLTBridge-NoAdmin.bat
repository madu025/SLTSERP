@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SLT-ERP Bridge - Chrome Extension Installer (No Admin)
:: Extracts extension and auto-loads via --load-extension flag
:: Creates Desktop shortcut for Chrome with extension
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
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT_NAME=Chrome with SLT-Bridge"

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
    echo.
    pause
    exit /b 1
)

echo  Extension extracted successfully!
echo.

:: Create Desktop shortcut
echo  Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%.lnk'); $sc.TargetPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; $sc.Arguments = '--load-extension=""%EXTENSION_DIR%""'; $sc.Description = 'Chrome with SLT-ERP Bridge extension'; $sc.IconLocation = 'C:\Program Files\Google\Chrome\Application\chrome.exe,0'; $sc.Save()"

if exist "%DESKTOP%\%SHORTCUT_NAME%.lnk" (
    echo  Desktop shortcut created: %SHORTCUT_NAME%.lnk
) else (
    echo  WARNING: Could not create Desktop shortcut.
)
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
echo  FROM NOW ON: Use the Desktop shortcut
echo  "%SHORTCUT_NAME%" to start Chrome.
echo.
echo  NOTE: If you see a yellow bar about developer
echo  mode extensions, click "Keep changes".
echo.
echo  To update: Re-run this installer.
echo.
pause
