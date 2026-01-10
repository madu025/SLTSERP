@echo off
REM ============================================
REM SLTSERP Database Restore Script
REM Restore database from backup file
REM ============================================

echo.
echo ======================================
echo   SLTSERP Database Restore Tool
echo ======================================
echo.

REM Configuration
set DB_CONTAINER=sltserp-db
set DB_NAME=nexuserp
set DB_USER=postgres
set BACKUP_DIR=backups\manual

REM Check if backup file provided
if "%1"=="" (
    echo Usage: restore-database.bat [backup_file.sql]
    echo.
    echo Available backups:
    echo.
    dir /B /O-D %BACKUP_DIR%\*.sql 2>nul
    if errorlevel 1 (
        echo No backups found in %BACKUP_DIR%
    )
    echo.
    pause
    exit /b 1
)

set BACKUP_FILE=%1

REM Check if file exists
if not exist "%BACKUP_FILE%" (
    echo ERROR: Backup file not found: %BACKUP_FILE%
    pause
    exit /b 1
)

echo.
echo ======================================
echo   WARNING: DATABASE RESTORE
echo ======================================
echo.
echo This will REPLACE ALL DATA in the database!
echo Backup file: %BACKUP_FILE%
echo.

REM Get file size
for %%A in (%BACKUP_FILE%) do set SIZE=%%~zA
echo File size: %SIZE% bytes
echo.
echo.

set /p CONFIRM=Type 'YES' to continue, or anything else to cancel: 

if /I not "%CONFIRM%"=="YES" (
    echo.
    echo Restore cancelled.
    pause
    exit /b 0
)

echo.
echo Checking Docker...

REM Check Docker
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    pause
    exit /b 1
)

REM Check container
docker ps | findstr %DB_CONTAINER% >nul
if errorlevel 1 (
    echo ERROR: Database container not running!
    pause
    exit /b 1
)

echo.
echo Restoring database...
echo.

REM Restore database
docker exec -i %DB_CONTAINER% psql -U %DB_USER% -d %DB_NAME% < "%BACKUP_FILE%"

if errorlevel 1 (
    echo.
    echo ERROR: Restore failed!
    pause
    exit /b 1
)

echo.
echo ======================================
echo   Restore Completed Successfully!
echo ======================================
echo.
echo Database has been restored from:
echo %BACKUP_FILE%
echo.
echo Please restart your application:
echo   npm run dev
echo.

pause
