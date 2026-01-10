@echo off
REM ============================================
REM SLTSERP Database Backup Script
REM Run this daily to backup your database
REM ============================================

echo.
echo ======================================
echo   SLTSERP Database Backup Tool
echo ======================================
echo.

REM Create timestamp
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

REM Configuration
set DB_CONTAINER=sltserp-db
set DB_NAME=nexuserp
set DB_USER=postgres
set BACKUP_DIR=backups\manual

REM Create backup directory if not exists
if not exist %BACKUP_DIR% (
    echo Creating backup directory...
    mkdir %BACKUP_DIR%
)

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if database container is running
docker ps | findstr %DB_CONTAINER% >nul
if errorlevel 1 (
    echo ERROR: Database container is not running!
    echo Please start the database: docker-compose up -d
    pause
    exit /b 1
)

echo Creating backup...
echo Timestamp: %TIMESTAMP%
echo.

REM Create backup
docker exec %DB_CONTAINER% pg_dump -U %DB_USER% %DB_NAME% > %BACKUP_DIR%\backup_%TIMESTAMP%.sql

if errorlevel 1 (
    echo.
    echo ERROR: Backup failed!
    pause
    exit /b 1
)

echo.
echo ======================================
echo   Backup Completed Successfully!
echo ======================================
echo.
echo Location: %BACKUP_DIR%\backup_%TIMESTAMP%.sql

REM Get file size
for %%A in (%BACKUP_DIR%\backup_%TIMESTAMP%.sql) do set SIZE=%%~zA

echo Size: %SIZE% bytes
echo.

REM Show all backups
echo.
echo Recent backups:
dir /B /O-D %BACKUP_DIR%\*.sql | findstr /N "^" | findstr "^[1-5]:"

echo.
echo TIP: Keep backups in multiple locations!
echo Consider copying to Google Drive, external drive, etc.
echo.

pause
