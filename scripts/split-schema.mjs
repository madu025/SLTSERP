/**
 * Prisma Schema Splitter
 * Splits the monolithic schema.prisma into multiple module files
 * under prisma/schema/ using Prisma 6 multi-file schema feature.
 *
 * Usage: node scripts/split-schema.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_FILE = path.join(ROOT, 'prisma', 'schema.prisma');
const OUTPUT_DIR = path.join(ROOT, 'prisma', 'schema');

// ─── Model → Module mapping ──────────────────────────────────────────────────
const MODEL_MODULE_MAP = {
  // enums (handled separately from models)

  // user.prisma
  User: 'user',
  Staff: 'user',
  Notification: 'user',
  NotificationPreference: 'user',
  AuditLog: 'user',

  // opmc.prisma
  OPMC: 'opmc',

  // service-order.prisma
  ServiceOrder: 'service-order',
  SODForensicAudit: 'service-order',
  ExtensionRawData: 'service-order',
  ServiceOrderStatusHistory: 'service-order',
  ServiceOrderComment: 'service-order',
  RestoreRequest: 'service-order',
  SODRevenueConfig: 'service-order',
  SODMaterialUsage: 'service-order',
  SLTPATStatus: 'service-order',
  PATSession: 'service-order',
  PATPointResult: 'service-order',

  // contractor.prisma
  Contractor: 'contractor',
  ContractorTeam: 'contractor',
  TeamMember: 'contractor',
  TeamStoreAssignment: 'contractor',
  ContractorStock: 'contractor',
  ContractorPaymentConfig: 'contractor',
  ContractorPaymentTier: 'contractor',
  ContractorPerformanceScore: 'contractor',
  Penalty: 'contractor',

  // inventory.prisma
  InventoryStore: 'inventory',
  InventoryItem: 'inventory',
  InventoryStock: 'inventory',
  InventoryBatch: 'inventory',
  InventoryBatchStock: 'inventory',
  InventoryTransaction: 'inventory',
  InventoryTransactionItem: 'inventory',
  InventoryItemSerial: 'inventory',
  MaterialCategory: 'inventory',
  MaterialStandard: 'inventory',
  CurrentStock: 'inventory',

  // stock-management.prisma
  StockRequest: 'stock-management',
  StockRequestItem: 'stock-management',
  StockIssue: 'stock-management',
  StockIssueItem: 'stock-management',
  GRN: 'stock-management',
  GRNItem: 'stock-management',
  MRN: 'stock-management',
  MRNItem: 'stock-management',
  StockMovement: 'stock-management',
  ContractorBatchStock: 'stock-management',
  ContractorMaterialIssue: 'stock-management',
  ContractorMaterialIssueItem: 'stock-management',
  ContractorMaterialReturn: 'stock-management',
  ContractorMaterialReturnItem: 'stock-management',
  ContractorWastage: 'stock-management',
  ContractorWastageItem: 'stock-management',
  ContractorMaterialBalanceSheet: 'stock-management',
  ContractorBalanceSheetItem: 'stock-management',
  ProjectMaterialReturn: 'stock-management',
  ProjectMaterialReturnItem: 'stock-management',

  // project-core.prisma
  Project: 'project-core',
  ProjectType: 'project-core',
  Job: 'project-core',
  ProjectBOQItem: 'project-core',
  ProjectMilestone: 'project-core',
  ProjectExpense: 'project-core',
  ProjectTask: 'project-core',
  TaskDependency: 'project-core',
  TaskProgressLog: 'project-core',
  Timesheet: 'project-core',
  ProjectResource: 'project-core',
  ProjectDocument: 'project-core',
  ProjectDocumentVersion: 'project-core',
  DailyProgress: 'project-core',
  BOQRateConfig: 'project-core',
  BOQApproval: 'project-core',

  // project-finance.prisma
  Invoice: 'project-finance',
  ProjectInvoice: 'project-finance',
  ProjectInvoiceItem: 'project-finance',
  PaymentVoucher: 'project-finance',
  ProjectRequisition: 'project-finance',
  ProjectRequisitionItem: 'project-finance',
  ProjectPurchaseOrder: 'project-finance',
  ProjectPurchaseOrderItem: 'project-finance',
  ProjectGoodsReceipt: 'project-finance',
  ProjectGoodsReceiptItem: 'project-finance',
  ProjectLDPenalty: 'project-finance',
  ProjectRetention: 'project-finance',
  RetentionRelease: 'project-finance',
  ProjectChangeOrder: 'project-finance',
  ProjectPayment: 'project-finance',
  Vendor: 'project-finance',
  Bank: 'project-finance',
  BankBranch: 'project-finance',
  Quotation: 'project-finance',
  QuotationItem: 'project-finance',

  // project-workflow.prisma
  WorkflowTemplate: 'project-workflow',
  WorkflowStageTemplate: 'project-workflow',
  WorkflowTaskTemplate: 'project-workflow',
  WorkflowChecklistTemplate: 'project-workflow',
  WorkflowApprovalTemplate: 'project-workflow',
  WorkflowConditionTemplate: 'project-workflow',
  ProjectWorkflowInstance: 'project-workflow',
  ProjectStageInstance: 'project-workflow',
  ProjectTaskInstance: 'project-workflow',
  ProjectChecklistInstance: 'project-workflow',
  ProjectApprovalInstance: 'project-workflow',
  WorkflowAuditLog: 'project-workflow',
  StageGateRule: 'project-workflow',
  ProjectApprovalRequest: 'project-workflow',
  ProjectApprovalStep: 'project-workflow',
  ProjectSupervisorAssignment: 'project-workflow',

  // project-advanced.prisma
  ProjectRisk: 'project-advanced',
  ProjectInspection: 'project-advanced',
  ProjectEVM: 'project-advanced',
  EVMSnapshot: 'project-advanced',
  ProjectAsset: 'project-advanced',
  ProjectAssetCable: 'project-advanced',
  ProjectAssetConnection: 'project-advanced',
  ProjectAssetDocument: 'project-advanced',
  ProjectChangeRequest: 'project-advanced',
  ChangeApproval: 'project-advanced',
  AiPrediction: 'project-advanced',

  // gis.prisma
  GISRoute: 'gis',
  GISPole: 'gis',
  GISChamber: 'gis',
  GISClosure: 'gis',
  GISCableSegment: 'gis',
  GISGeneratedBOQ: 'gis',
  GISGeneratedBOQItem: 'gis',
  GISAuditLog: 'gis',
  QFieldCloudSyncLog: 'gis',
  MobileSurveySession: 'gis',
  SurveyPoint: 'gis',

  // survey.prisma
  SurveyRequest: 'survey',
  SurveyCheckIn: 'survey',
  SurveyPhoto: 'survey',
  SurveyFinding: 'survey',
  FieldTask: 'survey',
  FieldPhoto: 'survey',
  FieldChecklist: 'survey',
  FieldSignature: 'survey',
  OTDRTest: 'survey',
  OTDRTestEvent: 'survey',
  HSESafetyLog: 'survey',
  HSEAttendee: 'survey',

  // permits.prisma
  AuthorityEntity: 'permits',
  PermitType: 'permits',
  ProjectPermit: 'permits',
  ProjectPermitDocument: 'permits',
  PermitApprovalStep: 'permits',

  // vehicle-management.prisma
  Vehicle: 'vehicle-management',
  VMSite: 'vehicle-management',
  VMVehicle: 'vehicle-management',
  VMOwnedVehicle: 'vehicle-management',
  VMRentalVehicle: 'vehicle-management',
  VMRentedVehicleMonthlySummary: 'vehicle-management',
  VMDriver: 'vehicle-management',
  VMDriverOT: 'vehicle-management',
  VMTrip: 'vehicle-management',
  VMFuelLog: 'vehicle-management',
  VMInsurancePolicy: 'vehicle-management',
  VMWarranty: 'vehicle-management',
  VMComplianceStatus: 'vehicle-management',
  VMPayment: 'vehicle-management',
  VMInvoice: 'vehicle-management',
  VMInvoiceItem: 'vehicle-management',
  VMTaxConfig: 'vehicle-management',
  VMDispatchOrder: 'vehicle-management',
  VMGPSLocation: 'vehicle-management',
  VMGeofence: 'vehicle-management',
  VMVehicleLog: 'vehicle-management',

  // system.prisma
  TableColumnSettings: 'system',
  Section: 'system',
  SystemRole: 'system',
  UserSectionAssignment: 'system',
  SystemConfig: 'system',
  SystemSetting: 'system',
  DashboardStat: 'system',
};

// ─── Enum → Module mapping ───────────────────────────────────────────────────
const ENUM_MODULE = 'enums'; // All enums go here

// ─── Parser ─────────────────────────────────────────────────────────────────
function parseSchema(content) {
  const blocks = {
    generator: '',
    datasource: '',
    models: {},   // modelName → block text
    enums: {},    // enumName → block text
  };

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Generator block
    if (trimmed.startsWith('generator ')) {
      let block = line + '\n';
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        block += lines[i] + '\n';
        if (lines[i].includes('{')) depth++;
        if (lines[i].includes('}')) depth--;
        i++;
      }
      blocks.generator = block;
      continue;
    }

    // Datasource block
    if (trimmed.startsWith('datasource ')) {
      let block = line + '\n';
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        block += lines[i] + '\n';
        if (lines[i].includes('{')) depth++;
        if (lines[i].includes('}')) depth--;
        i++;
      }
      blocks.datasource = block;
      continue;
    }

    // Model block
    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      const modelName = modelMatch[1];
      let block = line + '\n';
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        if (lines[i].includes('{')) depth++;
        if (lines[i].includes('}')) depth--;
        block += lines[i] + '\n';
        i++;
      }
      blocks.models[modelName] = block;
      continue;
    }

    // Enum block
    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      let block = line + '\n';
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        if (lines[i].includes('{')) depth++;
        if (lines[i].includes('}')) depth--;
        block += lines[i] + '\n';
        i++;
      }
      blocks.enums[enumName] = block;
      continue;
    }

    i++;
  }

  return blocks;
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  console.log('📖 Reading schema.prisma...');
  const content = fs.readFileSync(SCHEMA_FILE, 'utf-8');

  console.log('🔍 Parsing schema blocks...');
  const blocks = parseSchema(content);

  console.log(`   Found: ${Object.keys(blocks.models).length} models, ${Object.keys(blocks.enums).length} enums`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created: prisma/schema/`);
  }

  // ── _base.prisma ──────────────────────────────────────────────────────────
  // Add prismaSchemaFolder to generator's previewFeatures
  let generatorBlock = blocks.generator;
  if (!generatorBlock.includes('prismaSchemaFolder')) {
    // Add previewFeatures line before closing brace
    generatorBlock = generatorBlock.replace(
      /(\s*binaryTargets\s*=\s*\[.*?\])/,
      '$1\n  previewFeatures = ["prismaSchemaFolder"]'
    );
  }

  const baseContent = `${generatorBlock}\n${blocks.datasource}`;
  fs.writeFileSync(path.join(OUTPUT_DIR, '_base.prisma'), baseContent);
  console.log('✅ Written: _base.prisma');

  // ── enums.prisma ──────────────────────────────────────────────────────────
  const enumNames = Object.keys(blocks.enums);
  if (enumNames.length > 0) {
    const enumContent = `// ============================================================\n// Enums\n// ============================================================\n\n` +
      enumNames.map(name => blocks.enums[name]).join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'enums.prisma'), enumContent);
    console.log(`✅ Written: enums.prisma (${enumNames.length} enums)`);
  }

  // ── Module files ──────────────────────────────────────────────────────────
  // Group models by module
  const moduleModels = {};
  const unmapped = [];

  for (const [modelName, blockText] of Object.entries(blocks.models)) {
    const module = MODEL_MODULE_MAP[modelName];
    if (!module) {
      unmapped.push(modelName);
      // Default to 'misc' for unmapped models
      if (!moduleModels['misc']) moduleModels['misc'] = {};
      moduleModels['misc'][modelName] = blockText;
    } else {
      if (!moduleModels[module]) moduleModels[module] = {};
      moduleModels[module][modelName] = blockText;
    }
  }

  if (unmapped.length > 0) {
    console.warn(`⚠️  Unmapped models (→ misc.prisma): ${unmapped.join(', ')}`);
  }

  // Write each module file
  for (const [moduleName, models] of Object.entries(moduleModels)) {
    const modelNames = Object.keys(models);
    const moduleContent =
      `// ============================================================\n` +
      `// Module: ${moduleName}\n` +
      `// Models: ${modelNames.join(', ')}\n` +
      `// ============================================================\n\n` +
      modelNames.map(name => models[name]).join('\n');

    fs.writeFileSync(path.join(OUTPUT_DIR, `${moduleName}.prisma`), moduleContent);
    console.log(`✅ Written: ${moduleName}.prisma (${modelNames.length} models)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUTPUT_DIR);
  console.log('\n📊 Summary:');
  console.log(`   Output directory: prisma/schema/`);
  console.log(`   Files created: ${files.length}`);
  console.log(`   Total models: ${Object.keys(blocks.models).length}`);
  console.log(`   Total enums: ${Object.keys(blocks.enums).length}`);
  console.log('\n⚡ Next steps:');
  console.log('   1. Update package.json: add "prisma": { "schema": "prisma/schema" }');
  console.log('   2. Run: npx prisma validate');
  console.log('   3. Run: npx prisma generate');
}

main();
