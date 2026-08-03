/**
 * Smart Decimal Fix: Uses tsc --noEmit output to find exact line/column positions
 * and insert .toNumber() at the correct location.
 * 
 * Strategy: Parse tsc error output, find lines with Decimal arithmetic errors,
 * and apply targeted fixes using line content analysis.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../');

// Run tsc and capture errors
let tscOutput;
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, encoding: 'utf8' });
  console.log('✅ No errors!');
  process.exit(0);
} catch (e) {
  tscOutput = e.stdout || e.message || '';
}

// Parse errors: file(line,col): error TSxxxx: message
const errorRegex = /^(src\/.+\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
const errors = [];
let match;
while ((match = errorRegex.exec(tscOutput)) !== null) {
  errors.push({
    file: match[1],
    line: parseInt(match[2]),
    col: parseInt(match[3]),
    code: match[4],
    msg: match[5],
  });
}

// Filter only Decimal-related arithmetic/assignment errors
const decimalErrors = errors.filter(e =>
  e.msg.includes("Decimal") && (
    e.code === 'TS2362' || // left side of arithmetic
    e.code === 'TS2363' || // right side of arithmetic
    e.code === 'TS2365' || // operator cannot be applied
    e.code === 'TS2322' || // type not assignable (Decimal not number)
    e.code === 'TS2345'    // argument type mismatch
  )
);

// Group by file
const byFile = {};
for (const err of decimalErrors) {
  if (!byFile[err.file]) byFile[err.file] = [];
  byFile[err.file].push(err);
}

console.log(`Found ${decimalErrors.length} Decimal errors across ${Object.keys(byFile).length} files`);

// All known Decimal field names
const DECIMAL_FIELDS = [
  'amount','price','cost','rate','total','balance','subtotal','credit','debit',
  'revenue','payout','fee','charge','budget','unitPrice','unitCost','unitRate',
  'totalPrice','totalCost','totalAmount','baseUnitRate','poleRate','perMeterRate',
  'rateAmount','exchangeRate','minAmount','maxAmount','allocatedAmount',
  'retentionAmount','retentionPercent','releaseAmount','releasedAmount','balanceAmount',
  'paidAmount','discountAmount','taxAmount','vatAmount','ssclAmount','whtAmount',
  'openingBalance','closingBalance','currentBalance','imprestLimit','creditLimit',
  'netBookValue','purchaseCost','accumulatedDepreciation','depreciationAmount',
  'salvageValue','costVariance','scheduleVariance','estimateAtCompletion',
  'estimateToComplete','cpi','spi','acCurrentPeriod','evCurrentPeriod','pvCurrentPeriod',
  'acTotal','evTotal','pvTotal','ceilingValue','monthlyRent','laborCost',
  'costImpact','originalValue','newValue','coverageLimit','premiumAmount',
  'baseAmount','fuelCost','financialImpactLkr','quantity','qty','length',
  'routeLength','poleSpacing','totalLength','maxDistance','minDistance',
  'actualDistanceKm','plannedDistanceKm','fuelConsumedLiters','quantityLiters',
  'lastOdometer','startOdometer','endOdometer','expectedStartOdometer',
  'hoursWorked','hours','cablePulled','depth','height','carryForwardQuantity',
  'closingBalanceQuantity','faultyQuantity','receivedQuantity','totalInHandQuantity',
  'totalUsageQuantity','usageQuantity','wastageQuantity','physicalAuditedQty',
  'systemCalculatedQty','acceptedQuantity','actualQuantity','requestedQty',
  'approvedQty','issuedQty','receivedQty','balanceQty','quantityAccepted',
  'quantityOrdered','quantityReceived','quantityRejected','progress','progressPct',
  'passRate','allocationPercentage','confidenceScore','probabilityPct','usageRate',
  'wastageRate','score','qualityScore','safetyScore','scheduleScore','averageRating',
  'patPassPct','materialWastagePct','slaComplianceScore','timelineAdherencePct',
  'taxRatePercent','wastagePercent','plannedProgress','actualProgress',
  'latitude','longitude','elevation','altitude','bearing','heading',
  'verifiedLat','verifiedLng','gpsLatitude','gpsLongitude',
  // snake_case VM variants
  'base_amount','tax_amount','total_amount','tax_rate_percent','line_total',
  'unit_price','line_tax','coverage_limit','excess_amount','insured_value',
  'premium_amount','actual_distance_km','planned_distance_km','fuel_consumed_liters',
  'fuel_cost','start_odometer','end_odometer','expected_start_odometer','last_odometer',
  'depreciation_rate_percent','absent_deduction_rate','fuel_efficiency',
  'total_km_traveled','capacity_cargo_weight_kg','capacity_cargo_volume_m3',
  'start_location_lat','start_location_lng','end_location_lat','end_location_lng',
  'speed_kmh','ot_rate_multiplier',
];

// Build regex from field names
const FIELD_RE = new RegExp(
  `(?<!\\.toNumber\\(\\)\\s*)\\b((?:\\w+\\??(?:\\.\\w+)*\\.)?(?:${DECIMAL_FIELDS.join('|')}))(?!\\.toNumber)(?!\\.toString)(?!\\.toPrecision)(?!\\.toFixed)(?!\\.valueOf)(?=\\s*(?:[+\\-*/<>=!]|\\)))`,
  'g'
);

let filesFixed = 0;
let totalReplacements = 0;

for (const [relFile, fileErrors] of Object.entries(byFile)) {
  const filePath = path.join(ROOT, relFile);
  if (!fs.existsSync(filePath)) continue;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const targetLines = new Set(fileErrors.map(e => e.line - 1)); // 0-indexed

  let changed = false;
  let fileReplacements = 0;

  for (const lineIdx of targetLines) {
    const original = lines[lineIdx];
    if (!original) continue;

    // Replace decimal field accesses with .toNumber()
    const fixed = original.replace(FIELD_RE, (match) => {
      return `${match}.toNumber()`;
    });

    if (fixed !== original) {
      lines[lineIdx] = fixed;
      changed = true;
      fileReplacements++;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    filesFixed++;
    totalReplacements += fileReplacements;
    console.log(`✅ ${relFile} (${fileReplacements} lines fixed)`);
  } else {
    console.log(`⚠️  ${relFile} - errors found but regex didn't match (needs manual fix)`);
  }
}

console.log(`\nDone: ${totalReplacements} lines fixed across ${filesFixed} files`);
