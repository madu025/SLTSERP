import { HelpdeskService } from '../src/services/helpdesk.service';
import { SoftwareLicenseService } from '../src/services/software-license.service';
import { HelpdeskAuditService } from '../src/services/helpdesk-audit.service';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('============================================================');
  console.log('[BACKTEST] Starting Comprehensive Backend Audit & Test...');
  console.log('[BACKTEST] Targeting: HELP DESK and ITAM modules');
  console.log('============================================================');

  let siteId: string;
  let userId: string;
  let staffId: string;
  let assetId: string;
  let ticketId: string;
  let licenseId: string;
  let assignmentId: string;
  let unitId: string;
  let auditIdCorporate: string;
  let auditIdPersonal: string;

  let isTempSiteCreated = false;
  let isTempUserCreated = false;

  // ------------------------------------------------------------
  // 0. Pre-cleanup (in case previous run crashed)
  // ------------------------------------------------------------
  console.log('[BACKTEST] [0] Performing database pre-cleanup...');
  
  // Clean Software License Assignments
  await prisma.softwareLicenseAssignment.deleteMany({
    where: { remarks: { contains: 'BACKTEST' } }
  });
  
  // Clean Software Licenses
  await prisma.softwareLicense.deleteMany({
    where: { name: { contains: 'BACKTEST' } }
  });

  // Clean Asset Units
  await prisma.iTAssetUnit.deleteMany({
    where: { remarks: { contains: 'BACKTEST' } }
  });

  // Clean Handover Logs
  await prisma.assetHandoverLog.deleteMany({
    where: { 
      OR: [
        { remarks: { contains: 'BACKTEST' } },
        { asset: { serialNumber: { contains: 'BACKTEST' } } }
      ]
    }
  });

  // Clean Ticket Updates
  await prisma.ticketUpdate.deleteMany({
    where: { 
      OR: [
        { message: { contains: 'BACKTEST' } },
        { ticket: { description: { contains: 'BACKTEST' } } }
      ]
    }
  });

  // Clean Tickets
  await prisma.ticket.deleteMany({
    where: { description: { contains: 'BACKTEST' } }
  });

  // Clean Audits
  await prisma.iTAssetAudit.deleteMany({
    where: { remarks: { contains: 'BACKTEST' } }
  });

  // Clean IT Assets
  await prisma.iTAsset.deleteMany({
    where: { 
      OR: [
        { serialNumber: { contains: 'BACKTEST' } },
        { assetNumber: { contains: 'BACKTEST' } }
      ]
    }
  });

  // Clean Users and Staff
  await prisma.user.deleteMany({
    where: { username: { contains: 'backtest' } }
  });
  await prisma.staff.deleteMany({
    where: { employeeId: { contains: 'BACKTEST' } }
  });

  console.log('[BACKTEST] Pre-cleanup completed successfully.');

  // ------------------------------------------------------------
  // 1. Setup Common Test Context (Site, User, Staff)
  // ------------------------------------------------------------
  console.log('[BACKTEST] [1] Setting up common test context...');

  // Get or create site
  let site = await prisma.vMSite.findFirst();
  if (!site) {
    console.log('[BACKTEST] Creating a temporary VMSite...');
    site = await prisma.vMSite.create({
      data: {
        name: 'Colombo Backtest Office',
        code: 'SITE-COLOMBO-BT',
        address: 'Colombo 01',
        city: 'Colombo',
        state: 'Western',
        postal_code: '00100',
        country: 'Sri Lanka',
        manager_id: 'manager-backtest',
        status: 'ACTIVE'
      }
    });
    isTempSiteCreated = true;
  }
  siteId = site.id;

  // Get or create test User (Admin/Engineer equivalent)
  let user = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });
  if (!user) {
    user = await prisma.user.findFirst();
  }
  if (!user) {
    console.log('[BACKTEST] Creating a temporary test User...');
    const hashedPassword = await bcrypt.hash('password999', 10);
    user = await prisma.user.create({
      data: {
        email: 'backtest-admin@slt.lk',
        username: 'backtestadmin',
        password: hashedPassword,
        name: 'Backtest Admin User',
        role: 'ADMIN'
      }
    });
    isTempUserCreated = true;
  }
  userId = user.id;
  console.log(`[BACKTEST] Using administrator user ID: ${userId} (${user.username})`);

  // Create Staff profile
  const staff = await prisma.staff.create({
    data: {
      name: 'Custodian Backtest Staff',
      employeeId: 'EMP-BACKTEST-999',
      designation: 'ENGINEER'
    }
  });
  staffId = staff.id;
  console.log(`[BACKTEST] Staff profile created with ID: ${staffId} (EMP-BACKTEST-999)`);

  // ------------------------------------------------------------
  // 2. ITAM: IT Assets & Asset Units
  // ------------------------------------------------------------
  console.log('[BACKTEST] [2] Testing IT Assets & Units (ITAM)...');

  // Create IT Asset
  const asset = await HelpdeskService.createAsset(
    userId,
    {
      assetNumber: 'SLT-IT-BACKTEST-999',
      serialNumber: 'SN-BACKTEST-999',
      deviceType: 'LAPTOP',
      brand: 'HP',
      model: 'EliteBook 840 G8',
      status: 'SPARE',
      purchaseCost: 195000,
      purchaseDate: new Date('2026-05-15'),
      warrantyExpiry: new Date('2029-05-15')
    },
    '127.0.0.1',
    'BacktestClient'
  );
  assetId = asset.id;
  console.log(`[BACKTEST] Created ITAsset: ${asset.assetNumber} (ID: ${assetId})`);

  // Verify asset fields
  const fetchedAsset = await HelpdeskService.getAssetById(assetId);
  if (!fetchedAsset || fetchedAsset.serialNumber !== 'SN-BACKTEST-999') {
    throw new Error('Assert failed: Asset fields mismatch or asset not fetched');
  }

  // Create IT Asset Unit
  const unit = await HelpdeskService.createAssetUnit(
    userId,
    assetId,
    {
      serialNumber: 'SN-UNIT-BACKTEST-999',
      unitNumber: 'SLT-IT-UNIT-BACKTEST-999',
      status: 'IN_HAND_STORES',
      remarks: 'Primary backtest unit'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  unitId = unit.id;
  console.log(`[BACKTEST] Created ITAssetUnit: ${unit.serialNumber} (ID: ${unitId})`);

  // Test Asset Unit updates
  const updatedUnit = await HelpdeskService.updateAssetUnit(
    userId,
    unitId,
    {
      status: 'IN_HAND_STORES',
      remarks: 'Primary backtest unit - updated remarks'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  if (updatedUnit.remarks !== 'Primary backtest unit - updated remarks') {
    throw new Error('Assert failed: AssetUnit update did not save remarks correctly');
  }

  // ------------------------------------------------------------
  // 3. ITAM: Software Licenses & Assignments
  // ------------------------------------------------------------
  console.log('[BACKTEST] [3] Testing Software Licenses & Assignments (ITAM)...');

  // Create Software License
  const license = await SoftwareLicenseService.createLicense(
    userId,
    {
      name: 'Microsoft 365 BACKTEST',
      key: 'KEY-BACKTEST-M365-999',
      vendor: 'Microsoft',
      purchaseCost: 15000,
      totalLicenses: 10,
      status: 'ACTIVE',
      remarks: 'Backtest software license'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  licenseId = license.id;
  console.log(`[BACKTEST] Created SoftwareLicense: ${license.name} (ID: ${licenseId})`);

  // Assign Software License
  const assignment = await SoftwareLicenseService.assignLicense(
    userId,
    licenseId,
    {
      assignedUserId: userId,
      remarks: 'Assigned to admin user for BACKTEST purposes'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  assignmentId = assignment.id;
  console.log(`[BACKTEST] Assigned software license (Assignment ID: ${assignmentId})`);

  // Revoke Software License Assignment
  await SoftwareLicenseService.revokeLicense(userId, assignmentId, '127.0.0.1', 'BacktestClient');
  console.log('[BACKTEST] Revoked software license assignment successfully.');

  // Delete Software License
  await SoftwareLicenseService.deleteLicense(userId, licenseId, '127.0.0.1', 'BacktestClient');
  console.log('[BACKTEST] Deleted software license successfully.');

  // ------------------------------------------------------------
  // 4. ITAM: Asset Handovers & ERP User Account Auto-provisioning
  // ------------------------------------------------------------
  console.log('[BACKTEST] [4] Testing Handovers & User Auto-provisioning...');

  // Issue asset to backtest staff member
  await HelpdeskService.logAssetHandover(
    userId,
    assetId,
    {
      transactionType: 'ISSUED_TO_USER',
      targetStaffId: staffId,
      condition: 'Excellent',
      remarks: 'Issued during backend audit BACKTEST'
    },
    '127.0.0.1',
    'BacktestClient'
  );

  // Verify asset custodian was updated
  const handedOverAsset = await HelpdeskService.getAssetById(assetId);
  if (!handedOverAsset || handedOverAsset.assignedStaffId !== staffId) {
    throw new Error('Assert failed: Asset custodian was not set to staff member');
  }
  console.log('[BACKTEST] Verified: Custodian updated successfully.');

  // Verify User profile auto-provisioned
  const autoProvisionedUser = await prisma.user.findFirst({
    where: { staffId: staffId }
  });
  if (!autoProvisionedUser) {
    throw new Error('Assert failed: ERP User account was not auto-provisioned');
  }
  if (autoProvisionedUser.username !== 'emp-backtest-999') {
    throw new Error(`Assert failed: Username is ${autoProvisionedUser.username}, expected emp-backtest-999`);
  }
  if (!autoProvisionedUser.mustChangePassword) {
    throw new Error('Assert failed: mustChangePassword is false, expected true');
  }
  console.log('[BACKTEST] Verified: ERP User account successfully auto-provisioned.');

  // Return asset to store
  await HelpdeskService.logAssetHandover(
    userId,
    assetId,
    {
      transactionType: 'RETURNED_TO_STORE',
      condition: 'Good',
      remarks: 'Returned to store during backend audit BACKTEST'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  
  const returnedAsset = await HelpdeskService.getAssetById(assetId);
  if (!returnedAsset || returnedAsset.assignedStaffId !== null) {
    throw new Error('Assert failed: Asset custodian was not cleared on return to store');
  }
  console.log('[BACKTEST] Verified: Custodian cleared after returning asset to store.');

  // ------------------------------------------------------------
  // 5. Help Desk: Ticketing Lifecycle & SLA Verification
  // ------------------------------------------------------------
  console.log('[BACKTEST] [5] Testing Tickets & SLA Deadlines...');

  // Create CRITICAL ticket for software issue, verify defaults
  const ticket = await HelpdeskService.createTicket(
    userId,
    {
      assetId: assetId,
      category: 'HARDWARE_REPLACEMENT',
      description: 'Backtest: Battery swollen, requires urgent replacement.',
      priority: 'CRITICAL'
    },
    '127.0.0.1',
    'BacktestClient'
  );
  ticketId = ticket.id;
  console.log(`[BACKTEST] Ticket created: ${ticket.ticketNumber} (ID: ${ticketId})`);

  // Verify SLA deadlines calculated correctly for CRITICAL (Response: 1h, Resolution: 4h)
  const timeDifferenceResponse = (new Date(ticket.slaResponseDeadline!).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
  const timeDifferenceResolution = (new Date(ticket.slaResolutionDeadline!).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);

  if (Math.round(timeDifferenceResponse) !== 1) {
    throw new Error(`Assert failed: SLA Response deadline is ${timeDifferenceResponse} hours, expected 1`);
  }
  if (Math.round(timeDifferenceResolution) !== 4) {
    throw new Error(`Assert failed: SLA Resolution deadline is ${timeDifferenceResolution} hours, expected 4`);
  }
  console.log('[BACKTEST] Verified: Critical priority SLA deadlines calculated correctly.');

  // Verify linked asset is auto-transitioned to UNDER_REPAIR since category is hardware-related
  const assetDuringRepair = await HelpdeskService.getAssetById(assetId);
  if (!assetDuringRepair || assetDuringRepair.status !== 'UNDER_REPAIR') {
    throw new Error(`Assert failed: Asset status is ${assetDuringRepair?.status}, expected UNDER_REPAIR`);
  }
  console.log('[BACKTEST] Verified: IT Asset status auto-transitioned to UNDER_REPAIR.');

  // Add Comment and transition status to IN_PROGRESS
  await HelpdeskService.addTicketComment(
    userId,
    ticketId,
    {
      message: 'Backtest: Investigating battery availability in stores.',
      statusTo: 'IN_PROGRESS'
    },
    '127.0.0.1',
    'BacktestClient'
  );

  // Verify firstResponseAt logged
  const ticketResponded = await HelpdeskService.getTicketById(ticketId);
  if (!ticketResponded || !ticketResponded.firstResponseAt) {
    throw new Error('Assert failed: firstResponseAt timestamp was not logged');
  }
  console.log('[BACKTEST] Verified: firstResponseAt logged on ticket status transition.');

  // Resolve ticket and rate 5/5
  await HelpdeskService.updateTicket(
    userId,
    ticketId,
    {
      status: 'RESOLVED',
      satisfactionRating: 5,
      satisfactionNote: 'Backtest: Excellent service.'
    },
    '127.0.0.1',
    'BacktestClient'
  );

  // Verify resolvedAt logged
  const ticketResolved = await HelpdeskService.getTicketById(ticketId);
  if (!ticketResolved || !ticketResolved.resolvedAt || ticketResolved.satisfactionRating !== 5) {
    throw new Error('Assert failed: resolvedAt or satisfaction rating was not logged');
  }
  console.log('[BACKTEST] Verified: Ticket resolved and CSAT submitted.');

  // Verify asset transitions back out of UNDER_REPAIR (since resolved) to SPARE (as it has no custodian)
  const assetPostRepair = await HelpdeskService.getAssetById(assetId);
  if (!assetPostRepair || assetPostRepair.status !== 'SPARE') {
    throw new Error(`Assert failed: Asset status is ${assetPostRepair?.status}, expected SPARE`);
  }
  console.log('[BACKTEST] Verified: Asset status auto-restored after ticket resolution.');

  // Client response -> Auto-reopen ticket
  await HelpdeskService.addTicketComment(
    userId, // simulating creator response
    ticketId,
    {
      message: 'Backtest: Wait, the casing is still slightly warped. Reopening.'
    },
    '127.0.0.1',
    'BacktestClient'
  );

  const ticketReopened = await HelpdeskService.getTicketById(ticketId);
  if (!ticketReopened || ticketReopened.status !== 'OPEN' || ticketReopened.resolvedAt !== null) {
    throw new Error(`Assert failed: Expected status OPEN and resolvedAt null. Got status ${ticketReopened?.status}, resolvedAt ${ticketReopened?.resolvedAt}`);
  }
  console.log('[BACKTEST] Verified: Ticket auto-reopened and resolvedAt reset successfully.');

  // Clean up ticket updates & ticket before moving on (to allow cascade-clean or avoid duplicate keys later)
  await prisma.ticketUpdate.deleteMany({ where: { ticketId } });
  await prisma.ticket.delete({ where: { id: ticketId } });

  // ------------------------------------------------------------
  // 6. ITAM: Helpdesk Device Audits (ITAssetAudit)
  // ------------------------------------------------------------
  console.log('[BACKTEST] [6] Testing Device Audits (ITAM)...');

  // Update asset details in database to match the upcoming audit fields perfectly
  await prisma.iTAsset.update({
    where: { id: assetId },
    data: {
      assignedStaffId: staffId,
      department: 'IT',
      location: 'Floor 3',
      status: 'ACTIVE'
    }
  });

  // Submit Corporate Device Audit (Matching Serial SN-BACKTEST-999)
  const auditCorp = await HelpdeskAuditService.submitAudit({
    serialNumber: 'SN-BACKTEST-999',
    assetNumber: 'SLT-IT-BACKTEST-999',
    deviceType: 'LAPTOP',
    brand: 'HP',
    model: 'EliteBook 840 G8',
    employeeNo: 'EMP-BACKTEST-999',
    custodianName: 'Custodian Backtest Staff',
    status: 'ACTIVE',
    remarks: 'Backtest corporate audit response',
    isConfirmed: true,
    isPersonal: false,
    department: 'IT',
    siteOfficeId: null,
    location: 'Floor 3'
  });
  auditIdCorporate = auditCorp.id;
  console.log(`[BACKTEST] Corporate device audit response submitted (ID: ${auditIdCorporate})`);

  // Submit Personal Device Audit
  const auditPersonal = await HelpdeskAuditService.submitAudit({
    serialNumber: 'SN-PERSONAL-999',
    deviceType: 'MOBILE',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    employeeNo: 'EMP-BACKTEST-999',
    custodianName: 'Custodian Backtest Staff',
    status: 'ACTIVE',
    remarks: 'Backtest personal device audit response',
    isConfirmed: true,
    isPersonal: true
  });
  auditIdPersonal = auditPersonal.id;
  console.log(`[BACKTEST] Personal device audit response submitted (ID: ${auditIdPersonal})`);

  // Verify Audit records matching logic
  const auditList = await HelpdeskAuditService.getAudits();
  const fetchedCorp = auditList.find(a => a.id === auditIdCorporate);
  const fetchedPersonal = auditList.find(a => a.id === auditIdPersonal);

  if (!fetchedCorp || !fetchedCorp.isMatched) {
    throw new Error('Assert failed: Corporate audit isMatched should be true for perfect inventory match');
  }
  if (!fetchedPersonal || fetchedPersonal.isMatched) {
    throw new Error('Assert failed: Personal audit isMatched should be false (personal bypass)');
  }
  console.log('[BACKTEST] Verified: Audit match detection logic is correct.');

  // Test Audit Syncing to Inventory (matching new unregistered device audit)
  const auditUnregistered = await HelpdeskAuditService.submitAudit({
    serialNumber: 'SN-BACKTEST-UNREG-999',
    deviceType: 'DESKTOP',
    brand: 'Dell',
    model: 'OptiPlex 7090',
    employeeNo: 'EMP-BACKTEST-999',
    custodianName: 'Custodian Backtest Staff',
    status: 'ACTIVE',
    remarks: 'Backtest unregistered device audit response',
    isConfirmed: true,
    isPersonal: false,
    department: 'IT'
  });
  console.log(`[BACKTEST] Submitted unregistered device audit (ID: ${auditUnregistered.id})`);

  // --- Test Audit Gaps ---
  console.log('[BACKTEST] Testing Audit Gaps Identifier...');
  const gapsBeforeSync = await HelpdeskAuditService.getAuditGaps();
  
  // The unregistered audit should appear in unregisteredDevices
  const isUnregFound = gapsBeforeSync.unregisteredDevices.some(a => a.auditId === auditUnregistered.id);
  if (!isUnregFound) {
    throw new Error('Assert failed: Unregistered device audit missing from gaps unregisteredDevices list');
  }
  
  // The matched corporate audit should NOT appear in missing or mismatched
  const isCorpMissing = gapsBeforeSync.missingAudits.some(a => a.serialNumber === 'SN-BACKTEST-999');
  const isCorpMismatched = gapsBeforeSync.mismatchedData.some(a => a.auditId === auditIdCorporate);
  if (isCorpMissing || isCorpMismatched) {
    throw new Error('Assert failed: Corporate audit incorrectly flagged as gap (missing or mismatched)');
  }
  console.log(`[BACKTEST] Verified: Audit Gaps successfully identified ${gapsBeforeSync.summary.totalUnregistered} unregistered device(s).`);
  // -----------------------

  const syncedAudit = await HelpdeskAuditService.syncAuditToInventory(
    auditUnregistered.id,
    {
      assetNumber: 'SLT-IT-BACKTEST-UNREG'
    },
    userId
  );
  
  if (!syncedAudit.isSynced || !syncedAudit.isMatched) {
    throw new Error('Assert failed: Synced audit isSynced/isMatched flags not set');
  }

  // Verify the new asset was created in active inventory
  const newlyCreatedAsset = await prisma.iTAsset.findUnique({
    where: { serialNumber: 'SN-BACKTEST-UNREG-999' }
  });
  if (!newlyCreatedAsset || newlyCreatedAsset.assetNumber !== 'SLT-IT-BACKTEST-UNREG') {
    throw new Error('Assert failed: Unregistered device audit failed to provision new ITAsset in inventory');
  }
  console.log('[BACKTEST] Verified: Unregistered device audit successfully synced and registered in inventory.');

  // Test Audit Reject/Ignore
  await HelpdeskAuditService.rejectAudit(auditIdCorporate);
  const auditsAfterReject = await HelpdeskAuditService.getAudits();
  if (auditsAfterReject.some(a => a.id === auditIdCorporate)) {
    throw new Error('Assert failed: Rejected audit should be excluded from default list');
  }
  console.log('[BACKTEST] Verified: Reject audit successfully hides audit from list.');

  // ------------------------------------------------------------
  // 7. Cleanup & Disconnect
  // ------------------------------------------------------------
  console.log('[BACKTEST] [7] Performing database post-cleanup...');

  // Clean synced asset
  await prisma.assetHandoverLog.deleteMany({ where: { assetId: newlyCreatedAsset.id } });
  await prisma.iTAsset.delete({ where: { id: newlyCreatedAsset.id } });

  // Clean ITAssetUnit
  await HelpdeskService.deleteAssetUnit(userId, unitId, '127.0.0.1', 'BacktestClient');

  // Clean ITAsset
  await HelpdeskService.deleteAsset(userId, assetId, '127.0.0.1', 'BacktestClient');

  // Clean Audits
  await HelpdeskAuditService.deleteAudit(auditIdCorporate);
  await HelpdeskAuditService.deleteAudit(auditIdPersonal);
  await HelpdeskAuditService.deleteAudit(auditUnregistered.id);

  // Clean User and Staff
  await prisma.user.deleteMany({ where: { staffId: staffId } });
  await prisma.staff.delete({ where: { id: staffId } });

  if (isTempUserCreated) {
    await prisma.user.delete({ where: { id: userId } });
  }

  if (isTempSiteCreated) {
    await prisma.vMSite.delete({ where: { id: siteId } });
  }

  console.log('============================================================');
  console.log('[BACKTEST SUCCESS] All Help Desk and ITAM modules integration tests passed!');
  console.log('============================================================');
}

main()
  .catch((err) => {
    console.error('[BACKTEST FAILED] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0); // Explicitly exit to close Redis publisher/subscriber connections
  });
