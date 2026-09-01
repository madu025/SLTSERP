@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SLT-ERP Bridge - No-Admin Chrome Extension Installer
:: Extracts extension and opens chrome://extensions for manual load
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

:: Check if zip exists
if not exist "%ZIP_FILE%" (
    color 0C
    echo  ERROR: slt-bridge.zip not found!
    echo  Expected at: %ZIP_FILE%
    echo.
    echo  Download it from: https://sltserp.vercel.app/downloads/SLT-Bridge-Firefox.xpi
    echo  Or from the /extension-download page.
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

:: Open chrome://extensions
echo  Opening Chrome Extensions page...
echo.
echo  ============================================
echo  IMPORTANT: Complete these 3 steps:
echo  ============================================
echo.
echo  1. Enable "Developer mode" (bottom-left toggle)
echo  2. Click "Load unpacked" button
echo  3. Select this folder:
echo     %EXTENSION_DIR%
echo.
echo  Copy this path (Ctrl+C):
echo  %EXTENSION_DIR%
echo.
echo  ============================================
echo.

:: Copy path to clipboard
echo | set /p="%EXTENSION_DIR%" | clip

:: Open chrome://extensions
start "" "chrome://extensions"

echo  Path copied to clipboard!
echo  Paste it (Ctrl+V) in the folder picker dialog.
echo.
echo  After installation, the extension will work immediately.
echo  Updates require re-running this installer.
echo.
pause
