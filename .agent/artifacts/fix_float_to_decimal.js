/**
 * QA FIX v2: Replace Float with Decimal + @db.Decimal annotation in Prisma schema files
 * Correct Prisma syntax: fieldName Decimal @db.Decimal(14, 2)
 * NOT: fieldName Decimal(14, 2) @db.Decimal(14, 2)
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '../../prisma/schema');

const PRECISION_MAP = [
  // GPS coordinates
  { pattern: /^(latitude|longitude|lat|lng|gpsLat|gpsLng|gpsLatitude|gpsLongitude|verifiedLat|verifiedLng|startLat|startLng|endLat|endLng|start_location_lat|start_location_lng|end_location_lat|end_location_lng|elevation|altitude|bearing|heading|maxLat|maxLon|minLat|minLon)$/, db: '11, 8' },
  // Percentages / scores
  { pattern: /^(progress|progressPct|passRate|allocationPercentage|confidenceScore|probabilityPct|usageRate|wastageRate|timelineAdherencePct|patPassPct|materialWastagePct|slaComplianceScore|scheduleScore|safetyScore|qualityScore|productivityScore|averageRating|score|cpi|spi|retentionPercent|whtPercent|vatPercent|ssclPercent|tax_rate_percent|ot_rate_multiplier|depreciation_rate_percent|fuel_efficiency|fuel_efficiency_km_per_liter|wastagePercent)$/, db: '8, 4' },
  // Distances / quantities / lengths / speeds
  { pattern: /^(length|routeLength|poleSpacing|totalLength|maxDistance|minDistance|distanceThresholdMeters|actual_distance_km|planned_distance_km|odometer_reading_km|previous_odometer_km|last_odometer|start_odometer|end_odometer|expected_start_odometer|hoursWorked|hours|cablePulled|depth|height|capacity_cargo_volume_m3|capacity_cargo_weight_kg|speed_kmh|quantity|qty|quantity_liters|fuel_consumed_liters|cost_per_liter|orl|orlLimit|lossLimit|lossPerKm|spliceLoss|connectorLoss|endToEndLoss|reflectance|cumulativeLoss|loss|acceptedPower|measuredPower|propertyDamage|dataPlanLimit|carryForwardQuantity|closingBalanceQuantity|faultyQuantity|receivedQuantity|totalInHandQuantity|totalUsageQuantity|usageQuantity|wastageQuantity|physicalAuditedQty|systemCalculatedQty|varianceQuantity|ot_threshold_hours|overtime_hours|regular_hours|unitRate)$/, db: '12, 4' },
];

const DEFAULT_DB = '14, 2';

function getDbPrecision(fieldName) {
  for (const entry of PRECISION_MAP) {
    if (entry.pattern.test(fieldName)) return entry.db;
  }
  return DEFAULT_DB;
}

let totalReplaced = 0;
const changedFiles = [];

const schemaFiles = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.prisma'));

for (const file of schemaFiles) {
  const filePath = path.join(SCHEMA_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;

  const lines = content.split('\n');
  const newLines = lines.map(line => {
    if (line.trim().startsWith('//')) return line;

    // First: fix already broken lines written by v1: "Decimal(14, 2)?          @db.Decimal(14,2)"
    // Pattern: fieldName   Decimal(\d+, \d+)? ...
    const brokenMatch = line.match(/^(\s+)(\w+)(\s+)(Decimal\(\d+,\s*\d+\))(\??)\s*(.*)$/);
    if (brokenMatch) {
      const [, indent, fieldName, ws, , optional, rest] = brokenMatch;
      const db = getDbPrecision(fieldName);
      // Strip any existing @db.Decimal from rest
      const cleanRest = rest.replace(/@db\.Decimal\([^)]+\)/g, '').trimEnd();
      totalReplaced++;
      fileChanged = true;
      return `${indent}${fieldName}${ws}Decimal${optional} @db.Decimal(${db})${cleanRest ? ' ' + cleanRest : ''}`;
    }

    // Normal Float → Decimal replacement
    const floatMatch = line.match(/^(\s+)(\w+)(\s+)(Float)(\??)(.*)/);
    if (!floatMatch) return line;

    const [, indent, fieldName, ws, , optional, rest] = floatMatch;
    if (rest.includes('@db.Decimal')) return line;

    const db = getDbPrecision(fieldName);
    // Strip any default that's already there and keep it
    totalReplaced++;
    fileChanged = true;
    return `${indent}${fieldName}${ws}Decimal${optional}${rest.trimEnd()} @db.Decimal(${db})`;
  });

  if (fileChanged) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    changedFiles.push(file);
    console.log(`✅ Fixed: ${file}`);
  }
}

console.log(`\n✅ DONE: ${totalReplaced} fields fixed across ${changedFiles.length} schema files`);
