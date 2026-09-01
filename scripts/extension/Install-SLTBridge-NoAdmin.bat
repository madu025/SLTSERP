@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SLT-ERP Bridge - Chrome Extension Installer (No Admin)
:: Extracts extension and guides manual load (confirmed working)
:: ============================================================

title SLT-ERP Bridge Installer
color 0A

echo.
echo  ============================================
echo   SLT-ERP Bridge - Chrome Extension Installer
echo  ============================================
echo.

:: Set paths
set "EXTENSION_DIR=C:\SLT-Bridge"
set "SCRIPT_DIR=%~dp0"
set "ZIP_FILE=%SCRIPT_DIR%slt-bridge.zip"

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

:: Copy path to clipboard
echo | set /p="%EXTENSION_DIR%" | clip

:: Open chrome://extensions
echo  Opening Chrome Extensions page...
start "" "chrome://extensions"

echo.
echo  ============================================
echo  FINAL STEP - Manual Load (30 seconds):
echo  ============================================
echo.
echo  1. Enable "Developer mode" toggle (top-right)
echo  2. Click "Load unpacked" button
echo  3. Paste path (Ctrl+V) in folder picker:
echo.
echo     %EXTENSION_DIR%
echo.
echo  4. Click "Select Folder"
echo.
echo  ============================================
echo.
echo  Path copied to clipboard! Just paste it.
echo.
echo  After loading, the extension works immediately.
echo  To update: Re-run this installer, then click
echo  "Reload" on the extension card.
echo.
pause
