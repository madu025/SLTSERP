const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const allSystemRoles = [
  // EXECUTIVES
  { code: 'SUPER_ADMIN', name: 'Super Administrator', sectionCode: 'EXEC', level: 100, approvalLimit: 100000000.00, description: 'Full System Control and Global Configuration' },
  { code: 'ADMIN', name: 'System Administrator', sectionCode: 'EXEC', level: 90, approvalLimit: 50000000.00, description: 'Administrative Access & User Management' },
  { code: 'CEO', name: 'Chief Executive Officer', sectionCode: 'EXEC', level: 100, approvalLimit: 100000000.00, description: 'Executive Corporate Leadership' },
  { code: 'HEAD_OF_OSP', name: 'Head of OSP Operations', sectionCode: 'EXEC', level: 95, approvalLimit: 25000000.00, description: 'Head of Outside Plant Operations' },
  { code: 'REGIONAL_GENERAL_MANAGER', name: 'Regional General Manager', sectionCode: 'EXEC', level: 95, approvalLimit: 25000000.00, description: 'Executive Regional Governance' },

  // OPS & ENGINEERING
  { code: 'OSP_MANAGER', name: 'OSP Operations Manager', sectionCode: 'OSP_OPS', level: 80, approvalLimit: 5000000.00, description: 'OSP Project Management & Service Order Authorization' },
  { code: 'AREA_MANAGER', name: 'Area OPMC Manager', sectionCode: 'OSP_OPS', level: 70, approvalLimit: 2000000.00, description: 'Regional OPMC Operations & Material Release Authorization' },
  { code: 'ENGINEER', name: 'OSP Planning Engineer', sectionCode: 'OSP_OPS', level: 50, approvalLimit: 500000.00, description: 'Technical Design & Survey Processing' },
  { code: 'ASSISTANT_ENGINEER', name: 'Assistant OSP Engineer', sectionCode: 'OSP_OPS', level: 45, approvalLimit: 300000.00, description: 'Engineering Assistance & Field Survey' },
  { code: 'AREA_COORDINATOR', name: 'Area Coordinator', sectionCode: 'OSP_OPS', level: 50, approvalLimit: 500000.00, description: 'Field Coordination & PAT Status Review' },
  { code: 'OSP_ENGINEER', name: 'OSP Field Engineer', sectionCode: 'OSP_OPS', level: 50, approvalLimit: 500000.00, description: 'Field Engineering & Fiber Layout' },
  { code: 'CIVIL_SUPERVISOR', name: 'Civil Works Supervisor', sectionCode: 'OSP_OPS', level: 40, approvalLimit: 200000.00, description: 'Trenching, Ducting & Civil Construction' },
  { code: 'CABLE_SPLICER', name: 'Fiber Cable Splicer', sectionCode: 'OSP_OPS', level: 30, approvalLimit: 100000.00, description: 'Optical Fiber Splicing & OTDR Testing' },

  // FINANCE & INVOICING
  { code: 'FINANCE_MANAGER', name: 'Finance Manager', sectionCode: 'FINANCE', level: 80, approvalLimit: 10000000.00, description: 'Financial Ledger & Invoicing Approvals' },
  { code: 'FINANCE_ASSISTANT', name: 'Finance Assistant', sectionCode: 'FINANCE', level: 40, approvalLimit: 500000.00, description: 'Financial Voucher Processing & Data Entry' },
  { code: 'CASHIER', name: 'Petty Cashier', sectionCode: 'FINANCE', level: 30, approvalLimit: 100000.00, description: 'Petty Cash Operations & Receipts' },
  { code: 'INVOICE_MANAGER', name: 'Invoice Manager', sectionCode: 'FINANCE', level: 75, approvalLimit: 5000000.00, description: 'Contractor Invoice Processing & Verification' },
  { code: 'INVOICE_ASSISTANT', name: 'Invoice Assistant', sectionCode: 'FINANCE', level: 35, approvalLimit: 200000.00, description: 'Invoice Verification & Document Check' },
  { code: 'AR_OFFICER', name: 'Accounts Receivable Officer', sectionCode: 'FINANCE', level: 45, approvalLimit: 500000.00, description: 'Customer Collections & AR Ledger' },

  // STORES & LOGISTICS
  { code: 'STORES_MANAGER', name: 'Inventory & Stores Manager', sectionCode: 'STORES', level: 60, approvalLimit: 1000000.00, description: 'Warehouse, MIN/MRN Issue & Inventory Audit Control' },
  { code: 'STORES_ASSISTANT', name: 'Stores Assistant', sectionCode: 'STORES', level: 30, approvalLimit: 100000.00, description: 'Warehouse Material Receiving & Bin Stacking' },
  { code: 'LOGISTICS_MANAGER', name: 'Logistics Manager', sectionCode: 'STORES', level: 65, approvalLimit: 1500000.00, description: 'Fleet Management & Transport Authorization' },
  { code: 'PROCUREMENT_OFFICER', name: 'Procurement Officer', sectionCode: 'STORES', level: 55, approvalLimit: 1000000.00, description: 'Purchase Order Issuance & Supplier Relations' },

  // QUALITY CONTROL & AUDITING
  { code: 'QC_OFFICER', name: 'Quality Control Officer', sectionCode: 'QC', level: 50, approvalLimit: 200000.00, description: 'PAT Inspection & Workmanship Verification' },
  { code: 'SF_AUDIT_MANAGER', name: 'SF Audit Manager', sectionCode: 'QC', level: 75, approvalLimit: 5000000.00, description: 'Special Forensic Audit Supervision' },
  { code: 'SF_AUDIT_OFFICER', name: 'SF Audit Officer', sectionCode: 'QC', level: 50, approvalLimit: 500000.00, description: 'Forensic Audit Inspection & Discrepancy Flagging' },
  { code: 'RATE_AUDITOR', name: 'Contractor Rate Auditor', sectionCode: 'QC', level: 55, approvalLimit: 1000000.00, description: 'Rate Rule Audit & Rate Variance Review' },

  // CONTRACTOR PORTAL
  { code: 'CONTRACTOR_SUPERVISOR', name: 'Contractor Team Supervisor', sectionCode: 'CONTRACTOR', level: 40, approvalLimit: 100000.00, description: 'Contractor Work Allocation & Material Requisition' },
  { code: 'CONTRACTOR_TECHNICIAN', name: 'Contractor Technician', sectionCode: 'CONTRACTOR', level: 20, approvalLimit: 0.00, description: 'Field Work Execution & Mobile App Access' },
  { code: 'CONTRACTOR_FINANCE', name: 'Contractor Finance Officer', sectionCode: 'CONTRACTOR', level: 35, approvalLimit: 500000.00, description: 'Contractor Billing & Payout Tracking' },

  // SERVICE ASSURANCE & OTHER
  { code: 'SA_MANAGER', name: 'Service Assurance Manager', sectionCode: 'OSP_OPS', level: 75, approvalLimit: 2000000.00, description: 'Service Assurance & Fault Clearance Supervision' },
  { code: 'SA_ASSISTANT', name: 'Service Assurance Assistant', sectionCode: 'OSP_OPS', level: 35, approvalLimit: 100000.00, description: 'Fault Ticket Tracking & Dispatch' },
  { code: 'FAULT_COORDINATOR', name: 'Fault Coordinator', sectionCode: 'OSP_OPS', level: 40, approvalLimit: 200000.00, description: 'Fault Escalation & SLT Portal Coordination' },
  { code: 'REPAIR_TECHNICIAN', name: 'Repair Technician', sectionCode: 'OSP_OPS', level: 25, approvalLimit: 0.00, description: 'Drop Wire & CPE Fault Restoration' },
  { code: 'OFFICE_ADMIN', name: 'Office Administrator', sectionCode: 'EXEC', level: 50, approvalLimit: 500000.00, description: 'Site Office & Staff Administrative Management' },
  { code: 'OFFICE_ADMIN_ASSISTANT', name: 'Office Admin Assistant', sectionCode: 'EXEC', level: 30, approvalLimit: 100000.00, description: 'Office Administration Assistance' },
  { code: 'SITE_OFFICE_STAFF', name: 'Site Office Staff', sectionCode: 'EXEC', level: 30, approvalLimit: 100000.00, description: 'Site Office Operations & Document Receiving' },
  { code: 'MANAGER', name: 'General Manager', sectionCode: 'EXEC', level: 75, approvalLimit: 5000000.00, description: 'General Operational Management' }
];

async function main() {
  console.log('🌱 Seeding COMPLETE 37+ SystemRoles & Sections in Supabase...');

  // 1. Ensure Sections exist
  const sections = [
    { code: 'EXEC', name: 'Executive & Administration', description: 'Executive Leadership & System Administration', icon: 'ShieldCheck', color: '#4F46E5' },
    { code: 'FINANCE', name: 'Finance & Accounting', description: 'Financial Ledgers, Invoicing & Budget Allocations', icon: 'BadgeDollarSign', color: '#059669' },
    { code: 'OSP_OPS', name: 'OSP Operations & Engineering', description: 'Outside Plant Infrastructure & Service Order Management', icon: 'Network', color: '#2563EB' },
    { code: 'STORES', name: 'Stores & Material Logistics', description: 'Warehouse Management, Stock Issues, GRN & MRN', icon: 'Warehouse', color: '#D97706' },
    { code: 'QC', name: 'Quality Control & PAT Inspection', description: 'PAT Verification & Field Audits', icon: 'ClipboardCheck', color: '#7C3AED' },
    { code: 'CONTRACTOR', name: 'Contractor Operations', description: 'Contractor Teams, Work Requisitions & Material Usage', icon: 'HardHat', color: '#DC2626' }
  ];

  const sectionMap = new Map();
  for (const sec of sections) {
    const s = await prisma.section.upsert({
      where: { code: sec.code },
      update: { name: sec.name },
      create: sec
    });
    sectionMap.set(sec.code, s.id);
  }

  // 2. Seed all 37 SystemRole Master Records
  let seededRoles = 0;
  for (const roleDef of allSystemRoles) {
    const sectionId = sectionMap.get(roleDef.sectionCode) || null;
    await prisma.systemRole.upsert({
      where: { code: roleDef.code },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        level: roleDef.level,
        approvalLimit: roleDef.approvalLimit,
        sectionId
      },
      create: {
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        level: roleDef.level,
        approvalLimit: roleDef.approvalLimit,
        sectionId
      }
    });
    seededRoles++;
  }

  console.log(`✅ ALL ${seededRoles} SystemRoles seeded section-wise in Supabase PostgreSQL.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
