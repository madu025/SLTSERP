import { HelpdeskService } from '../src/services/helpdesk.service';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('[TEST] Starting backend running tests for IT Help Desk (ITSM)...');

  let siteId: string;
  let userId: string;
  let staffId: string;
  let assetId: string;
  let ticketId: string;

  let isTempSiteCreated = false;
  let isTempUserCreated = false;

  // 0. Pre-cleanup in case a previous run crashed
  console.log('[TEST] Performing pre-test database cleanup...');
  await prisma.user.deleteMany({
    where: { username: 'emp-test-handover-999' }
  });
  await prisma.staff.deleteMany({
    where: { employeeId: 'EMP-TEST-HANDOVER-999' }
  });
  await prisma.assetHandoverLog.deleteMany({
    where: { asset: { assetNumber: 'SLT-IT-TEST-999' } }
  });
  await prisma.ticketUpdate.deleteMany({
    where: { ticket: { asset: { assetNumber: 'SLT-IT-TEST-999' } } }
  });
  await prisma.ticket.deleteMany({
    where: { asset: { assetNumber: 'SLT-IT-TEST-999' } }
  });
  await prisma.iTAsset.deleteMany({
    where: { assetNumber: 'SLT-IT-TEST-999' }
  });
  console.log('[TEST] Pre-cleanup completed.');

  // 1. Fetch or create a temporary VMSite
  let site = await prisma.vMSite.findFirst();
  if (!site) {
    console.log('[TEST] No site found. Creating a temporary site...');
    site = await prisma.vMSite.create({
      data: {
        name: 'Colombo Test Site',
        code: 'SITE-COLOMBO-99',
        address: 'Lotus Road, Colombo 01',
        city: 'Colombo',
        state: 'Western',
        postal_code: '00100',
        country: 'Sri Lanka',
        latitude: 6.9319,
        longitude: 79.8478,
        contact_person: 'Admin Person',
        phone: '0112233445',
        email: 'colombosite@slt.lk',
        manager_id: 'manager-colombo',
        status: 'ACTIVE',
        vehicle_pool_capacity: 5
      }
    });
    isTempSiteCreated = true;
    console.log(`[TEST] Temporary site created with ID: ${site.id}`);
  }
  siteId = site.id;

  // 2. Fetch or create a temporary User
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log('[TEST] No user found. Creating a temporary test user...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email: 'testuser@slt.lk',
        username: 'testuser',
        password: hashedPassword,
        name: 'Test Support User',
        role: 'ENGINEER'
      }
    });
    isTempUserCreated = true;
    console.log(`[TEST] Temporary user created with ID: ${user.id}`);
  }
  userId = user.id;

  // 3. Create a unique Staff profile to test auto-provisioning
  console.log('[TEST] Creating temporary Staff profile to test auto-provisioning...');
  const testStaff = await prisma.staff.create({
    data: {
      name: 'Temp Test Staff Handover',
      employeeId: 'EMP-TEST-HANDOVER-999',
      designation: 'ENGINEER'
    }
  });
  staffId = testStaff.id;
  console.log(`[TEST] Temporary staff created with ID: ${staffId}`);

  // 4. Create a test IT Asset (LAPTOP)
  console.log('[TEST] Creating a new IT Asset...');
  const asset = await HelpdeskService.createAsset(
    userId,
    {
      assetNumber: 'SLT-IT-TEST-999',
      serialNumber: 'SN-TEST-LAPTOP-999',
      deviceType: 'LAPTOP',
      brand: 'HP',
      model: 'EliteBook 840 G8',
      status: 'SPARE',
      purchaseCost: 185000,
      purchaseDate: new Date('2026-01-10'),
      warrantyExpiry: new Date('2029-01-10')
    },
    '127.0.0.1',
    'TestClient'
  );
  assetId = asset.id;
  console.log(`[TEST] IT Asset created successfully (ID: ${assetId})`);

  // 5. Create a Support Ticket linked to the asset
  console.log('[TEST] Creating a Support Ticket...');
  const ticket = await HelpdeskService.createTicket(
    userId,
    {
      assetId: assetId,
      category: 'SOFTWARE_ISSUE',
      description: 'The operating system is hanging frequently during startup.',
      priority: 'HIGH'
    },
    '127.0.0.1',
    'TestClient'
  );
  ticketId = ticket.id;
  console.log(`[TEST] Ticket created successfully (Number: ${ticket.ticketNumber}, ID: ${ticketId})`);

  // Verify optional ticket fields defaulting
  console.log('[TEST] Creating an optional ticket (without category and description)...');
  const optionalTicket = await HelpdeskService.createTicket(
    userId,
    {
      assetId: null,
    },
    '127.0.0.1',
    'TestClient'
  );
  if (optionalTicket.category !== 'OTHER') {
    throw new Error(`Assert failed: Expected default category OTHER, got ${optionalTicket.category}`);
  }
  if (optionalTicket.description !== 'No description provided.') {
    throw new Error(`Assert failed: Expected default description placeholder, got ${optionalTicket.description}`);
  }
  console.log('[TEST] Optional ticket created and defaulted successfully!');
  // Clean up optional ticket
  await prisma.ticketUpdate.deleteMany({ where: { ticketId: optionalTicket.id } });
  await prisma.ticket.delete({ where: { id: optionalTicket.id } });

  // Verify firstResponseAt is null initially
  if (ticket.firstResponseAt) {
    throw new Error('Assert failed: Ticket firstResponseAt should be null initially.');
  }

  // 6. Add a comment and update status to IN_PROGRESS
  console.log('[TEST] Adding a ticket comment and transitioning status to IN_PROGRESS...');
  await HelpdeskService.addTicketComment(
    userId,
    ticketId,
    {
      message: 'Investigated startup logs, boot partition looks corrupt. Running chkdsk.',
      statusTo: 'IN_PROGRESS'
    },
    '127.0.0.1',
    'TestClient'
  );
  console.log('[TEST] Ticket comment added and status set to IN_PROGRESS!');

  // Verify firstResponseAt was recorded
  const attendedTicket = await HelpdeskService.getTicketById(ticketId);
  if (!attendedTicket || !attendedTicket.firstResponseAt) {
    throw new Error('Assert failed: Ticket firstResponseAt was not recorded upon entering IN_PROGRESS status.');
  }
  console.log('[TEST] Verified: firstResponseAt (attended timestamp) successfully logged!');

  // 7. Log an Asset Handover (ISSUE_TO_USER) to verify custody update and auto-provisioning
  console.log('[TEST] Logging Asset Handover (ISSUED_TO_USER)...');
  await HelpdeskService.logAssetHandover(
    userId,
    assetId,
    {
      transactionType: 'ISSUED_TO_USER',
      targetStaffId: staffId,
      condition: 'Excellent - Brand New',
      remarks: 'Issued for official development tasks.'
    },
    '127.0.0.1',
    'TestClient'
  );
  console.log('[TEST] Asset Handover logged!');

  // Verify asset assignedStaffId was updated by the handover service transaction
  const updatedAsset = await HelpdeskService.getAssetById(assetId);
  if (!updatedAsset || updatedAsset.assignedStaffId !== staffId) {
    throw new Error('Assert failed: Asset custodian was not updated correctly after handover transaction.');
  }
  console.log('[TEST] Verified: Asset custodian updated to target staff ID successfully!');

  // Verify that a User account was automatically provisioned for this Staff member
  const provisionedUser = await prisma.user.findFirst({
    where: { staffId: staffId }
  });
  if (!provisionedUser) {
    throw new Error('Assert failed: ERP User account was not automatically provisioned during handover!');
  }
  if (provisionedUser.username !== 'emp-test-handover-999') {
    throw new Error(`Assert failed: Expected username emp-test-handover-999, got ${provisionedUser.username}`);
  }
  if (!provisionedUser.mustChangePassword) {
    throw new Error('Assert failed: mustChangePassword should be true for provisioned user accounts.');
  }
  console.log('[TEST] Verified: User account successfully auto-provisioned with username matching employeeId!');

  // 8. Resolve the ticket and submit CSAT rating
  console.log('[TEST] Resolving the ticket and adding CSAT rating...');
  await HelpdeskService.updateTicket(
    userId,
    ticketId,
    {
      status: 'RESOLVED',
      satisfactionRating: 5,
      satisfactionNote: 'Excellent service. Boot corruption fixed.'
    },
    '127.0.0.1',
    'TestClient'
  );
  console.log('[TEST] Ticket resolved and CSAT submitted!');

  // Verify resolvedAt was recorded
  const resolvedTicket = await HelpdeskService.getTicketById(ticketId);
  if (!resolvedTicket || !resolvedTicket.resolvedAt) {
    throw new Error('Assert failed: Ticket resolvedAt was not recorded upon resolution.');
  }
  console.log('[TEST] Verified: resolvedAt (resolution timestamp) successfully logged!');

  // 9. Reopen the ticket by posting a client comment
  console.log('[TEST] Reopening ticket by posting client response (auto-reopen verification)...');
  await HelpdeskService.addTicketComment(
    userId, // creator of the ticket
    ticketId,
    {
      message: 'Wait, the boot loader issue has returned on secondary boot. Please re-check.'
    },
    '127.0.0.1',
    'TestClient'
  );

  const reopenedTicket = await HelpdeskService.getTicketById(ticketId);
  const expectedStatus = reopenedTicket?.assignedToId ? 'IN_PROGRESS' : 'OPEN';
  if (!reopenedTicket || reopenedTicket.status !== expectedStatus) {
    throw new Error(`Assert failed: Expected status ${expectedStatus} after customer response, got ${reopenedTicket?.status}`);
  }
  if (reopenedTicket.resolvedAt !== null) {
    throw new Error('Assert failed: Ticket resolvedAt was not cleared (reset to null) on ticket reopen.');
  }
  console.log(`[TEST] Verified: Ticket successfully auto-reopened to ${expectedStatus} status and resolvedAt cleared!`);

  // 10. Assert details in DB
  const retrievedTicket = await HelpdeskService.getTicketById(ticketId);
  if (!retrievedTicket) throw new Error('Assert failed: Resolved ticket not found.');
  console.log('[TEST] Assertions check: Passed!');

  // 11. Clean up test records
  console.log('[TEST] Cleaning up test data from database...');

  // Delete Handover Logs
  await prisma.assetHandoverLog.deleteMany({
    where: { assetId: assetId }
  });
  console.log('[TEST] Deleted test AssetHandoverLogs.');

  // Delete Ticket Updates
  await prisma.ticketUpdate.deleteMany({
    where: { ticketId: ticketId }
  });
  console.log('[TEST] Deleted test TicketUpdates.');

  // Delete Ticket
  await prisma.ticket.delete({
    where: { id: ticketId }
  });
  console.log('[TEST] Deleted test Ticket.');

  // Delete Asset
  await prisma.iTAsset.delete({
    where: { id: assetId }
  });
  console.log('[TEST] Deleted test ITAsset.');

  // Delete auto-provisioned User
  await prisma.user.deleteMany({
    where: { staffId: staffId }
  });
  console.log('[TEST] Deleted auto-provisioned test User.');

  // Delete temporary Staff
  await prisma.staff.delete({
    where: { id: staffId }
  });
  console.log('[TEST] Deleted temporary test Staff.');

  // Delete temporary user if created
  if (isTempUserCreated) {
    await prisma.user.delete({
      where: { id: userId }
    });
    console.log('[TEST] Deleted temporary test User.');
  }

  // Delete temporary site if created
  if (isTempSiteCreated) {
    await prisma.vMSite.delete({
      where: { id: siteId }
    });
    console.log('[TEST] Deleted temporary test VMSite.');
  }

  console.log('[TEST] SUCCESS: The entire IT Help Desk (ITSM) integration test suite passed successfully!');
}

main()
  .catch((err) => {
    console.error('[TEST] ERROR: IT Help Desk test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
