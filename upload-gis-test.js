// ============================================================================
// QGIS Upload Test Script
// Uploads KL-SVK-0567 GeoJSON files and creates a test project
// ============================================================================
// Run: node upload-gis-test.js
// Make sure dev server is running: npx next dev
// ============================================================================

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const GEOJSON_DIR = path.resolve(__dirname, 'KL-SVK-0567', 'GeoJSON');
const GIS_FILES = [
    'KL-SVK-0567_Cables.geojson',
    'KL-SVK-0567_Poles.geojson',
    'KL-SVK-0567_FDP.geojson',
    'KL-SVK-0567_FJ.geojson',
    'KL-SVK-0567_Road_EOPs.geojson',
];

// Auth token from .auth/user.json
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtcTducTk4NjAwMDBzaWhzMmR0c3R4ZzEiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzgxMzY2MTQ1LCJleHAiOjE3ODE0NTI1NDV9.C_Fov6rljBqqhXHe-N45_CyUcpuEhPprNuOdCyNV884';

async function apiCall(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `token=${AUTH_TOKEN}`,
            ...options.headers,
        },
    });
    return response;
}

async function uploadFiles() {
    console.log('========================================');
    console.log('📤 Uploading QGIS files...');
    console.log('========================================\n');

    // Read the GeoJSON files as raw text (not base64 encoded)
    // The upload endpoint accepts both multipart/form-data and JSON body
    // For JSON, we send base64 encoded content
    const files = [];
    for (const fileName of GIS_FILES) {
        const filePath = path.join(GEOJSON_DIR, fileName);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const base64 = Buffer.from(content).toString('base64');
            files.push({
                fileName,
                fileData: base64,
            });
            console.log(`  ✅ ${fileName} (${(content.length / 1024).toFixed(1)} KB)`);
        } else {
            console.log(`  ❌ ${fileName} NOT FOUND at ${filePath}!`);
        }
    }

    console.log(`\n  Total files: ${files.length}/5\n`);

    // Step 1: Upload files
    console.log('📤 Step 1: Uploading to /api/gis/upload...');
    const uploadResult = await apiCall(`${BASE_URL}/api/gis/upload`, {
        method: 'POST',
        body: JSON.stringify({
            files,
            projectName: 'KL-SVK-0567 Fiber Project',
            region: 'Eastern',
            district: 'Kalmunai',
            createdById: 'cmq7nq9860000sihs2dtstxg1',
        }),
    });

    if (!uploadResult.ok) {
        const errText = await uploadResult.text();
        console.error(`  ❌ Upload failed (${uploadResult.status}): ${errText}`);
        process.exit(1);
    }

    const uploadData = await uploadResult.json();
    const { importId } = uploadData;
    console.log(`  ✅ Upload successful!`);
    console.log(`  📝 Import ID: ${importId}\n`);

    // Step 2: Process GIS data
    console.log('⚙️  Step 2: Processing GIS data...');
    console.log('     (This may take 5-30 seconds...)');
    const processResult = await apiCall(`${BASE_URL}/api/gis/process`, {
        method: 'POST',
        body: JSON.stringify({ importId }),
    });

    if (!processResult.ok) {
        const errText = await processResult.text();
        console.error(`  ❌ Processing failed (${processResult.status}): ${errText}`);
        process.exit(1);
    }

    const processData = await processResult.json();
    const result = processData.result;

    console.log(`  ✅ Processing complete!`);
    console.log(`\n${'='.repeat(55)}`);
    console.log(`📊 PROJECT CREATED SUCCESSFULLY!`);
    console.log(`${'='.repeat(55)}`);
    console.log(`  🆔 Project ID:     ${result.projectId}`);
    console.log(`  📋 Project Code:   ${result.projectCode}`);
    console.log(`  📛 Project Name:   ${result.projectName}`);
    console.log(`  🏗️  Type:          ${result.projectType}`);
    console.log(`  📈 Confidence:     ${result.confidence}%`);
    console.log(`  📦 Assets:         ${result.assetsCreated}`);
    console.log(`  📋 Survey Tasks:   ${result.surveyTasksCreated}`);
    console.log(`  📜 Permits:        ${result.permitsCreated}`);
    console.log(`  🔄 Workflow:       ${result.workflowInstantiated ? '✅ Instantiated' : '❌ Failed'}`);
    if (result.stagesCreated) console.log(`  📋 Stages:         ${result.stagesCreated}`);
    if (result.tasksCreated) console.log(`  ✅ Tasks:          ${result.tasksCreated}`);
    console.log(`  💰 BOQ Total:      LKR ${result.boq.totalEstimatedCost.toLocaleString()}`);
    console.log(`  📏 Route Length:   ${(result.analytics.totalRouteLength / 1000).toFixed(3)} km`);
    console.log(`  📐 Area Covered:   ${(result.analytics.coverageStatistics.areaCovered / 1000000).toFixed(4)} sq km`);
    console.log(`\n  🌐 Open in browser:`);
    console.log(`     http://localhost:3000/projects/${result.projectId}`);
    console.log(`${'='.repeat(55)}\n`);
}

uploadFiles().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
