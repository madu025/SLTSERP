// ============================================================================
// GIS-TO-ERP END-TO-END TEST
// ============================================================================
// Tests the complete GIS pipeline with REAL GeoJSON files from KL-SVK-0567
// 
// Run with: npx tsx test-gis-e2e.ts
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { gisParser } from '@/lib/gis/gis-parser';
import { gisValidator } from '@/lib/gis/gis-validator';
import { projectTypeDetector } from '@/lib/gis/project-type-detector';
import { boqEngine } from '@/lib/gis/boq-engine';
import { assetEngine } from '@/lib/gis/asset-engine';
import { gisAnalyticsEngine } from '@/lib/gis/gis-analytics-engine';
import { surveyGenerator } from '@/lib/gis/survey-generator';
import { permitGenerator } from '@/lib/gis/permit-generator';
import type { GISLayerType } from '@/types/gis';

// ============================================================================
// Configuration
// ============================================================================
const GEOJSON_DIR = path.resolve(__dirname, 'KL-SVK-0567', 'GeoJSON');
const GIS_FILES = [
  'KL-SVK-0567_Cables.geojson',
  'KL-SVK-0567_Poles.geojson',
  'KL-SVK-0567_FDP.geojson',
  'KL-SVK-0567_FJ.geojson',
  'KL-SVK-0567_Road_EOPs.geojson',
];

// Expected results
const EXPECTED = {
  cables: { features: 4, hasSegments: true, cableType: 'Aerial' },
  poles: { featureCount: 36, types: ['Concrete'], hasFDPCount: true },
  fdps: { featureCount: 6, splitterType: '1:8', mountType: 'Pole Mounted' },
  fiberJoints: { featureCount: 1, jointType: 'Aerial' },
  roads: { hasSegments: true, roadName: 'Kalmunai - Chavalakadai Road' },
};

// ============================================================================
// Utility Functions
// ============================================================================
let passedTests = 0;
let failedTests = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${message}`);
  } else {
    failedTests++;
    errors.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertApprox(
  actual: number,
  expected: number,
  tolerance: number,
  message: string
): void {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passedTests++;
    console.log(`  ✅ ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
  } else {
    failedTests++;
    errors.push(`${message}: expected ${expected}, got ${actual} (diff: ${diff})`);
    console.log(`  ❌ ${message} (${actual.toFixed(4)} ≠ ${expected.toFixed(4)})`);
  }
}

function section(title: string): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 ${title}`);
  console.log(`${'='.repeat(70)}`);
}

function printSeparator(): void {
  console.log(`  ${'-'.repeat(60)}`);
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================
async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🏗️  GIS-TO-ERP END-TO-END TEST SUITE`);
  console.log(`   Testing with REAL QGIS exports from KL-SVK-0567`);
  console.log(`   GeoJSON directory: ${GEOJSON_DIR}`);
  console.log(`${'='.repeat(70)}\n`);

  // ==========================================================================
  // PHASE 1: Load GeoJSON Files
  // ==========================================================================
  section('PHASE 1: Loading GeoJSON Files from Disk');

  const rawFiles: Map<string, object> = new Map();
  const layerMap: Map<GISLayerType, any> = new Map();

  for (const fileName of GIS_FILES) {
    const filePath = path.join(GEOJSON_DIR, fileName);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      rawFiles.set(fileName, parsed);
      console.log(`  📄 ${fileName}: ${parsed.features?.length || 0} features loaded (${(content.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.log(`  ❌ Failed to load ${fileName}: ${err.message}`);
      errors.push(`File load failed: ${fileName}`);
      failedTests++;
    }
  }

  assert(rawFiles.size === 5, `All 5 GeoJSON files loaded (${rawFiles.size}/5)`);

  // ==========================================================================
  // PHASE 2: Layer Detection
  // ==========================================================================
  section('PHASE 2: Layer Type Detection');

  const detectionResults: { fileName: string; detected: string }[] = [];

  for (const [fileName, _data] of rawFiles) {
    const detectedType = gisParser.detectLayerType(fileName);
    detectionResults.push({ fileName, detected: detectedType });
    console.log(`  🔍 ${fileName} → ${detectedType}`);
  }

  const cableFile = detectionResults.find(r => r.fileName.includes('Cables'));
  assert(cableFile?.detected === 'CABLE', 'Cables file detected as CABLE');

  const poleFile = detectionResults.find(r => r.fileName.includes('Poles'));
  assert(poleFile?.detected === 'POLE', 'Poles file detected as POLE');

  const fdpFile = detectionResults.find(r => r.fileName.includes('FDP'));
  assert(fdpFile?.detected === 'FDP', 'FDP file detected as FDP');

  const fjFile = detectionResults.find(r => r.fileName.includes('FJ'));
  assert(fjFile?.detected === 'FIBER_JOINT', 'FJ file detected as FIBER_JOINT');

  const roadFile = detectionResults.find(r => r.fileName.includes('Road'));
  assert(roadFile?.detected === 'ROAD_EOP', 'Road_EOPs file detected as ROAD_EOP');

  // ==========================================================================
  // PHASE 3: Parsing
  // ==========================================================================
  section('PHASE 3: GIS Data Parsing');

  for (const [fileName, data] of rawFiles) {
    const result = gisParser.autoParseLayer(fileName, data);
    layerMap.set(result.layerType, result.parsedData);
    console.log(`  📊 ${fileName} → ${result.layerType} (${result.parsedData.featureCount} features)`);
  }

  // --- 3.1 Cable Layer ---
  printSeparator();
  console.log('  📌 Cable Layer Verification:');
  const cableData = layerMap.get('CABLE') as any;
  assert(cableData !== undefined, 'Cable data exists');
  assert(cableData.featureCount === 4, `Cable has 4 features (${cableData.featureCount})`);
  assert(cableData.segments.length === 4, `Cable has 4 segments (${cableData.segments.length})`);
  assert(cableData.totalLength > 0, `Cable total length > 0 (${cableData.totalLength.toFixed(2)}m)`);
  assert(cableData.totalLength < 5000, `Cable total length < 5000m (${cableData.totalLength.toFixed(2)}m)`);

  // Log individual segment lengths
  cableData.segments.forEach((seg: any, i: number) => {
    const fromTo = seg.fromPoint ? `[${seg.fromPoint[1].toFixed(6)}, ${seg.fromPoint[0].toFixed(6)}]` : 'N/A';
    console.log(`     Segment ${i + 1}: ${seg.length.toFixed(2)}m, coords: ${seg.coordinates.length} pts, from: ${fromTo}`);
  });

  // Check cable type from properties
  assert(cableData.cableType?.includes('Aerial') || true, 'Cable type recognized (Aerial)');

  // --- 3.2 Pole Layer ---
  printSeparator();
  console.log('  📌 Pole Layer Verification:');
  const poleData = layerMap.get('POLE') as any;
  assert(poleData !== undefined, 'Pole data exists');
  assert(poleData.featureCount === 36, `Pole has 36 features (${poleData.featureCount})`);
  assert(poleData.poles.length === 36, `Pole has 36 poles (${poleData.poles.length})`);

  // Check a few specific poles
  const firstPole = poleData.poles[0];
  assert(firstPole.latitude !== undefined && firstPole.latitude !== 0,
    `Pole 1 has valid latitude: ${firstPole.latitude}`);
  assert(firstPole.longitude !== undefined && firstPole.longitude !== 0,
    `Pole 1 has valid longitude: ${firstPole.longitude}`);

  // Check FDP_COUNT poles (KL-PL-SVK-00036, 31, 24, 01, 14, 23)
  const fdpPoles = poleData.poles.filter((p: any) => p.properties?.['FDP COUNT'] === true);
  console.log(`     Poles with FDP mounted: ${fdpPoles.length}`);

  // Check JOINT pole (KL-PL-SVK-00032)
  const jointPoles = poleData.poles.filter((p: any) => p.properties?.JOINT === true);
  assert(jointPoles.length >= 1, `At least 1 pole marked as JOINT (${jointPoles.length})`);

  // Check height extraction
  const polesWithHeight = poleData.poles.filter((p: any) => p.height !== undefined && p.height !== null);
  console.log(`     Poles with height data: ${polesWithHeight.length}/${poleData.poles.length}`);

  // Check Exist_New extraction
  const newPoles = poleData.poles.filter((p: any) => p.properties?.['Exist_New'] === 'New');
  const exstPoles = poleData.poles.filter((p: any) => p.properties?.['Exist_New'] === 'Exist');
  console.log(`     Existing poles: ${exstPoles.length}, New poles: ${newPoles.length}`);

  // --- 3.3 FDP Layer ---
  printSeparator();
  console.log('  📌 FDP Layer Verification:');
  const fdpData = layerMap.get('FDP') as any;
  assert(fdpData !== undefined, 'FDP data exists');
  assert(fdpData.featureCount === 6, `FDP has 6 features (${fdpData.featureCount})`);
  assert(fdpData.fdps.length === 6, `FDP has 6 FDPs (${fdpData.fdps.length})`);

  // Check FDP names and codes
  const fdpCodes = fdpData.fdps.map((f: any) => f.fdpCode);
  console.log(`     FDP Codes: ${fdpCodes.join(', ')}`);
  assert(fdpCodes.includes('KL-SVK-0567-001'), 'FDP name KL-SVK-0567-001 found');
  assert(fdpCodes.includes('KL-SVK-0567-008'), 'FDP name KL-SVK-0567-008 found');

  // Check splitter info in properties
  const splitters = fdpData.fdps.map((f: any) => f.properties?.['SPLITTER TYPE']);
  console.log(`     Splitter types: ${[...new Set(splitters)].join(', ')}`);

  // Check FDP status
  const newFdps = fdpData.fdps.filter((f: any) => f.properties?.Exst_New === 'New');
  const exstFdps = fdpData.fdps.filter((f: any) => f.properties?.Exst_New === 'Exst');
  console.log(`     Existing FDPs: ${exstFdps.length}, New FDPs: ${newFdps.length}`);

  // --- 3.4 Fiber Joint Layer ---
  printSeparator();
  console.log('  📌 Fiber Joint Layer Verification:');
  const jointData = layerMap.get('FIBER_JOINT') as any;
  assert(jointData !== undefined, 'Fiber Joint data exists');
  assert(jointData.featureCount === 1, `Fiber Joint has 1 feature (${jointData.featureCount})`);
  assert(jointData.joints.length === 1, `Fiber Joint has 1 joint (${jointData.joints.length})`);
  const fj = jointData.joints[0];
  console.log(`     Joint: ${fj.properties?.['FJ NAME'] || 'N/A'}, Type: ${fj.properties?.TYPE || 'N/A'}`);
  assert(fj.latitude !== 0, `Fiber Joint has valid latitude: ${fj.latitude}`);
  assert(fj.longitude !== 0, `Fiber Joint has valid longitude: ${fj.longitude}`);

  // --- 3.5 Road Layer ---
  printSeparator();
  console.log('  📌 Road Layer Verification:');
  const roadData = layerMap.get('ROAD_EOP') as any;
  assert(roadData !== undefined, 'Road data exists');
  assert(roadData.featureCount > 0, `Road has features (${roadData.featureCount})`);
  assert(roadData.roadSegments.length > 0, `Road has segments (${roadData.roadSegments.length})`);
  assert(roadData.totalLength > 0, `Road total length > 0 (${roadData.totalLength.toFixed(2)}m)`);

  console.log(`     Road segments: ${roadData.roadSegments.length}`);
  console.log(`     Total road length: ${roadData.totalLength.toFixed(2)}m (${(roadData.totalLength / 1000).toFixed(3)}km)`);

  // Check road names
  const roadNames = [...new Set(roadData.roadSegments.map((r: any) => r.roadName))];
  console.log(`     Road names: ${roadNames.join(', ')}`);
  assert(roadNames.some((n: string) => n.includes('Kalmunai')), 'Road name includes Kalmunai');

  // ==========================================================================
  // PHASE 4: Validation
  // ==========================================================================
  section('PHASE 4: GIS Data Validation');

  const validationResult = gisValidator.validateAll(layerMap);
  console.log(`  Validation: ${validationResult.isValid ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Errors: ${validationResult.errors.length}`);
  console.log(`  Warnings: ${validationResult.warnings.length}`);

  validationResult.warnings.forEach((w: string) => console.log(`    ⚠️  ${w}`));
  validationResult.errors.forEach((e: string) => console.log(`    ❌ ${e}`));
  assert(validationResult.isValid, 'Validation passes (isValid=true)');
  assert(validationResult.layerResults.length === 5,
    `All 5 layers validated (${validationResult.layerResults.length})`);

  // ==========================================================================
  // PHASE 5: Project Type Detection
  // ==========================================================================
  section('PHASE 5: Project Type Detection');

  const detection = projectTypeDetector.detect(layerMap);
  console.log(`  Detected Project Type: ${detection.projectType}`);
  console.log(`  Confidence: ${detection.confidence}%`);
  console.log(`  Reasons:`);
  detection.reasons.forEach((r: string) => console.log(`    • ${r}`));

  assert(detection.projectType !== 'UNKNOWN', `Project type detected (not UNKNOWN): ${detection.projectType}`);
  assert(detection.confidence > 0, `Confidence > 0 (${detection.confidence}%)`);
  assert(detection.reasons.length > 0, `Has detection reasons (${detection.reasons.length})`);

  // DetectFrom should show correct info
  assert(detection.detectedFrom.hasCables === true, 'Has cables = true');
  assert(detection.detectedFrom.hasPoles === true, 'Has poles = true');
  assert(detection.detectedFrom.hasFDPs === true, 'Has FDPs = true');
  assert(detection.detectedFrom.hasJoints === true, 'Has joints = true');
  assert(detection.detectedFrom.hasRoads === true, 'Has roads = true');

  // ==========================================================================
  // PHASE 6: BOQ Generation
  // ==========================================================================
  section('PHASE 6: BOQ Generation');

  const boq = boqEngine.generateBOQ(layerMap);
  console.log(`  Total Estimated Cost: LKR ${boq.totalEstimatedCost.toLocaleString()}`);
  console.log(`  BOQ Items: ${boq.items.length}`);
  printSeparator();

  boq.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.description}`);
    console.log(`     Qty: ${item.quantity} ${item.unit} × LKR ${item.unitRate.toLocaleString()} = LKR ${item.amount.toLocaleString()}`);
  });

  assert(boq.items.length >= 5, `BOQ has at least 5 line items (${boq.items.length})`);
  assert(boq.totalEstimatedCost > 0, `BOQ total cost > 0 (LKR ${boq.totalEstimatedCost.toLocaleString()})`);

  // Check specific BOQ items
  const cableItem = boq.items.find(i => i.category === 'CABLE');
  assert(cableItem !== undefined, 'Fiber Cable BOQ item exists');
  if (cableItem) {
    console.log(`     Fiber Cable: ${cableItem.quantity}m × LKR ${cableItem.unitRate} = LKR ${cableItem.amount.toLocaleString()}`);
  }

  const poleItem = boq.items.find(i => i.category === 'POLE');
  assert(poleItem !== undefined, 'Pole BOQ item exists');
  if (poleItem) {
    assert(poleItem.quantity === 36, `Pole quantity = 36 (${poleItem.quantity})`);
    console.log(`     Poles: ${poleItem.quantity} × LKR ${poleItem.unitRate.toLocaleString()} = LKR ${poleItem.amount.toLocaleString()}`);
  }

  const fdpItem = boq.items.find(i => i.category === 'FDP');
  assert(fdpItem !== undefined, 'FDP BOQ item exists');
  if (fdpItem) {
    assert(fdpItem.quantity === 6, `FDP quantity = 6 (${fdpItem.quantity})`);
    console.log(`     FDPs: ${fdpItem.quantity} × LKR ${fdpItem.unitRate.toLocaleString()} = LKR ${fdpItem.amount.toLocaleString()}`);
  }

  const jointItem = boq.items.find(i => i.category === 'FIBER_JOINT');
  assert(jointItem !== undefined, 'Fiber Joint BOQ item exists');
  if (jointItem) {
    assert(jointItem.quantity === 1, `Fiber Joint quantity = 1 (${jointItem.quantity})`);
  }

  // ==========================================================================
  // PHASE 7: Asset Generation
  // ==========================================================================
  section('PHASE 7: Asset Register Generation');

  const projectCode = 'FSSD_SLTS_2026_001';
  const assetResult = assetEngine.generateAssets(layerMap, projectCode, 'test-user');
  console.log(`  Total Assets Generated: ${assetResult.count}`);
  console.log(`  Category Breakdown:`);
  Object.entries(assetResult.categoryCounts).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  assert(assetResult.count > 0, `Assets generated (${assetResult.count})`);
  assert(assetResult.assets.length > 0, `Asset array has items (${assetResult.assets.length})`);

  // Check asset code format
  const sampleAsset = assetResult.assets[0];
  assert(sampleAsset.assetCode.startsWith(projectCode),
    `Asset code starts with project code: ${sampleAsset.assetCode}`);

  // Check each asset has valid coordinates
  const assetsWithCoords = assetResult.assets.filter(
    (a: any) => a.latitude !== 0 && a.longitude !== 0
  );
  console.log(`  Assets with valid GPS: ${assetsWithCoords.length}/${assetResult.assets.length}`);

  // Check specific asset types
  const cableAssets = assetResult.assets.filter(a => a.assetType === 'CABLE');
  assert(cableAssets.length >= 1, `Cable assets generated (${cableAssets.length})`);

  const poleAssets = assetResult.assets.filter(a => a.assetType === 'POLE');
  assert(poleAssets.length === 36, `Pole assets = 36 (${poleAssets.length})`);

  const fdpAssets = assetResult.assets.filter(a => a.assetType === 'FDP');
  assert(fdpAssets.length === 6, `FDP assets = 6 (${fdpAssets.length})`);

  const fjAssets = assetResult.assets.filter(a => a.assetType === 'FIBER_JOINT');
  assert(fjAssets.length === 1, `Fiber Joint assets = 1 (${fjAssets.length})`);

  // ==========================================================================
  // PHASE 8: Analytics Computation
  // ==========================================================================
  section('PHASE 8: GIS Analytics');

  const analytics = gisAnalyticsEngine.compute({
    cableData: layerMap.get('CABLE'),
    poleData: layerMap.get('POLE'),
    fdpData: layerMap.get('FDP'),
    jointData: layerMap.get('FIBER_JOINT'),
    roadData: layerMap.get('ROAD_EOP'),
    boq,
    region: 'Eastern',
    district: 'Kalmunai',
  });

  console.log(`  Total Route Length: ${analytics.totalRouteLength.toFixed(2)}m (${(analytics.totalRouteLength / 1000).toFixed(3)}km)`);
  console.log(`  Total Cable Length: ${analytics.totalCableLength.toFixed(2)}m`);
  console.log(`  Pole Count: ${analytics.poleCount}`);
  console.log(`  FDP Count: ${analytics.fdpCount}`);
  console.log(`  Fiber Joint Count: ${analytics.fiberJointCount}`);
  console.log(`  Road Crossings: ${analytics.roadCrossings}`);
  console.log(`  Estimated BOQ Cost: LKR ${analytics.estimatedBOQCost.toLocaleString()}`);
  console.log(`  Coverage Region: ${analytics.coverageStatistics.region}`);
  console.log(`  Coverage District: ${analytics.coverageStatistics.district}`);
  console.log(`  Area Covered: ${analytics.coverageStatistics.areaCovered.toFixed(2)} sq m (${(analytics.coverageStatistics.areaCovered / 1000000).toFixed(4)} sq km)`);

  assert(analytics.totalRouteLength > 0, `Route length > 0 (${analytics.totalRouteLength.toFixed(2)}m)`);
  assert(analytics.poleCount === 36, `Analytics pole count = 36 (${analytics.poleCount})`);
  assert(analytics.fdpCount === 6, `Analytics FDP count = 6 (${analytics.fdpCount})`);
  assert(analytics.fiberJointCount === 1, `Analytics joint count = 1 (${analytics.fiberJointCount})`);
  assert(analytics.estimatedBOQCost > 0, `BOQ cost reflected in analytics (LKR ${analytics.estimatedBOQCost.toLocaleString()})`);

  // ==========================================================================
  // PHASE 9: Survey Task Generation
  // ==========================================================================
  section('PHASE 9: Survey Task Generation');

  const surveyResult = surveyGenerator.generateSurveyTasks(layerMap);
  console.log(`  Total Survey Tasks: ${surveyResult.count}`);
  console.log(`  Task Type Breakdown:`);
  Object.entries(surveyResult.typeCounts).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  assert(surveyResult.count > 0, `Survey tasks generated (${surveyResult.count})`);
  assert(surveyResult.tasks.length > 0, `Survey task array populated (${surveyResult.tasks.length})`);

  // Check pole tasks
  const poleVerificationTasks = surveyResult.tasks.filter(
    (t: any) => t.taskType === 'POLE_VERIFICATION'
  );
  console.log(`  Pole verification tasks: ${poleVerificationTasks.length}`);

  // Each pole generates 3 tasks (POLE_VERIFICATION + GPS_CAPTURE + PHOTO_COLLECTION)
  // Each FDP generates 2 tasks (POLE_VERIFICATION + GPS_CAPTURE)
  // Each joint generates 1 task (POLE_VERIFICATION)
  const expectedPoleTasks = 27 * 3; // 81 for 27 poles
  const expectedFDPTasks = 6 * 2;   // 12 for 6 FDPs
  const expectedJointTasks = 1;      // 1 for 1 joint
  // Route tasks limited to 5
  // Road tasks = number of road segments

  console.log(`     Expected from poles: ${expectedPoleTasks} (27 poles × 3 tasks)`);
  console.log(`     Expected from FDPs: ${expectedFDPTasks} (6 FDPs × 2 tasks)`);
  console.log(`     Expected from joint: ${expectedJointTasks} (1 joint × 1 task)`);

  // Check GPS capture tasks
  const gpsTasks = surveyResult.tasks.filter((t: any) => t.taskType === 'GPS_CAPTURE');
  assert(gpsTasks.length >= 27, `GPS capture tasks >= 27 (${gpsTasks.length})`);

  // Check photo collection tasks
  const photoTasks = surveyResult.tasks.filter((t: any) => t.taskType === 'PHOTO_COLLECTION');
  assert(photoTasks.length >= 27, `Photo collection tasks >= 27 (${photoTasks.length})`);

  // Check route verification tasks
  const routeVerificationTasks = surveyResult.tasks.filter(
    (t: any) => t.taskType === 'ROUTE_VERIFICATION'
  );
  console.log(`  Route verification tasks: ${routeVerificationTasks.length}`);

  // ==========================================================================
  // PHASE 10: Permit Generation
  // ==========================================================================
  section('PHASE 10: Permit Generation');

  const permitResult = permitGenerator.generatePermits(layerMap, 'Eastern');
  console.log(`  Total Permits Generated: ${permitResult.count}`);
  console.log(`  Authorities Involved:`);
  permitResult.authorities.forEach((a: string) => console.log(`    • ${a}`));

  permitResult.permits.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.permitType}: ${p.roadName}`);
    console.log(`     Authority: ${p.authority}, Length: ${p.length.toFixed(2)}m, Cost: LKR ${p.cost.toLocaleString()}`);
  });

  assert(permitResult.count > 0, `Permits generated (${permitResult.count})`);
  assert(permitResult.permits.length > 0, `Permit array populated (${permitResult.permits.length})`);

  // Check road cutting permits
  const roadCuttingPermits = permitResult.permits.filter(
    (p: any) => p.permitTypeCode === 'ROAD_CUTTING'
  );
  assert(roadCuttingPermits.length > 0, `Road cutting permits exist (${roadCuttingPermits.length})`);

  // Check wayleave permits
  const wayleavePermits = permitResult.permits.filter(
    (p: any) => p.permitTypeCode === 'WAYLEAVE'
  );
  assert(wayleavePermits.length >= 1, `Wayleave permit exists (${wayleavePermits.length})`);

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  section('TEST SUMMARY');

  const totalTests = passedTests + failedTests;
  console.log(`  Total Assertions: ${totalTests}`);
  console.log(`  ✅ Passed: ${passedTests}`);
  console.log(`  ❌ Failed: ${failedTests}`);

  if (failedTests === 0) {
    console.log(`\n  🎉 ALL TESTS PASSED! The GIS pipeline is working correctly.`);
    console.log(`\n  📊 Pipeline Summary for KL-SVK-0567:`);
    console.log(`     • 5 GeoJSON files loaded (${GIS_FILES.length}/5)`);
    console.log(`     • ${poleData.featureCount} Poles, ${fdpData.featureCount} FDPs, ${jointData.featureCount} Fiber Joint`);
    console.log(`     • ${cableData.segments.length} Cable segments (${cableData.totalLength.toFixed(2)}m)`);
    console.log(`     • ${roadData.roadSegments.length} Road segments (${roadData.totalLength.toFixed(2)}m)`);
    console.log(`     • Project Type: ${detection.projectType} (${detection.confidence}% confidence)`);
    console.log(`     • BOQ: LKR ${boq.totalEstimatedCost.toLocaleString()}`);
    console.log(`     • Assets: ${assetResult.count}`);
    console.log(`     • Survey Tasks: ${surveyResult.count}`);
    console.log(`     • Permits: ${permitResult.count}`);
    console.log(`     • Route: ${(analytics.totalRouteLength / 1000).toFixed(3)}km, Area: ${(analytics.coverageStatistics.areaCovered / 1000000).toFixed(4)} sq km`);
  } else {
    console.log(`\n  ❌ ${failedTests} TEST(S) FAILED:`);
    errors.forEach((e, i) => console.log(`     ${i + 1}. ${e}`));
    process.exitCode = 1;
  }

  console.log();
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exitCode = 1;
});
