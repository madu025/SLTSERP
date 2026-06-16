@echo off
echo ========================================
echo 📤 Uploading QGIS files via curl...
echo ========================================
echo.

set TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtcTducTk4NjAwMDBzaWhzMmR0c3R4ZzEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgxMzY2MTQ1LCJleHAiOjE3ODE0NTI1NDV9.C_Fov6rljBqqhXHe-N45_CyUcpuEhPprNuOdCyNV884

echo Step 1: Uploading QGIS files...
echo.

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

echo.
echo ========================================
echo Done!
echo ========================================
pause
