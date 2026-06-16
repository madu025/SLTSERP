@echo off
cd /d D:\MyProject\SLTSERP
echo ========================================
echo 🚀 STEP 1: Starting Dev Server...
echo ========================================
echo.

echo Checking if node_modules exists...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
echo.

echo Starting Next.js dev server...
start "NextJS Dev" /MIN cmd /c "npx next dev"

echo Waiting 30 seconds for server to start...
ping -n 30 127.0.0.1 > nul

echo.
echo ========================================
echo STEP 2: Checking if server is running...
echo ========================================
node check_server.js
if %ERRORLEVEL% neq 0 (
    echo Server check script failed
)

echo.
echo ========================================
echo STEP 3: Uploading QGIS files via curl...
echo ========================================
echo.

set TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtcTducTk4NjAwMDBzaWhzMmR0c3R4ZzEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgxMzY2MTQ1LCJleHAiOjE3ODE0NTI1NDV9.C_Fov6rljBqqhXHe-N45_CyUcpuEhPprNuOdCyNV884

echo Uploading GeoJSON files...
echo.
echo Calling /api/gis/upload with 5 files...

curl -s -X POST http://localhost:3000/api/gis/upload ^
  -H "Cookie: token=%TOKEN%" ^
  -F "files=@KL-SVK-0567\GeoJSON\KL-SVK-0567_Cables.geojson" ^
  -F "files=@KL-SVK-0567\GeoJSON\KL-SVK-0567_Poles.geojson" ^
  -F "files=@KL-SVK-0567\GeoJSON\KL-SVK-0567_FDP.geojson" ^
  -F "files=@KL-SVK-0567\GeoJSON\KL-SVK-0567_FJ.geojson" ^
  -F "files=@KL-SVK-0567\GeoJSON\KL-SVK-0567_Road_EOPs.geojson" ^
  -F "projectName=KL-SVK-0567 Fiber Project" ^
  -F "region=Eastern" ^
  -F "district=Kalmunai"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Upload FAILED! Curl might not be available.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Done! Check the output above.
echo ========================================
echo.
pause
