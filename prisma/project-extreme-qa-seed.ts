import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ProjectService } from '../src/services/project/project.service';
import { ProjectMaterialReservationService } from '../src/services/project/project-material-reservation.service';
import { ProjectStockIssueService } from '../src/services/project/project-stock-issue.service';

const prisma = new PrismaClient();

const runId = Date.now().toString();
const projectCode = `QA-EXTREME-${runId}`;
const contractorRegistration = `QA-EXTREME-CON-${runId}`;
const surveyNumber = `QA-SUR-${runId}`;
const invoiceNumber = `QA-INV-${runId}`;
const paymentNumber = `QA-PV-${runId}`;
const quantityToIssue = 10;
const materialCode = 'OSPFTA003';

async function main() {
  const now = new Date();
  const password = await bcrypt.hash('Test@123', 10);

  const [admin, finance, storesRole, store, item, opmc] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: 'qa_admin' } }),
    prisma.user.findUniqueOrThrow({ where: { username: 'qa_finance' } }),
    prisma.user.findUniqueOrThrow({
      where: { username: 'storesmanager' },
      select: { systemRole: { select: { id: true } } },
    }),
    prisma.inventoryStore.findFirstOrThrow({
      where: { name: 'Kaduwela Store' },
      include: { opmcs: { select: { id: true } } },
    }),
    prisma.inventoryItem.findUniqueOrThrow({ where: { code: materialCode } }),
    prisma.oPMC.findFirstOrThrow({
      where: { storeId: (await prisma.inventoryStore.findFirstOrThrow({ where: { name: 'Kaduwela Store' } })).id },
      orderBy: { rtom: 'asc' },
    }),
  ]);

  const storeOpmcId = store.opmcs[0]?.id ?? opmc.id;
  const storeActor = await prisma.user.upsert({
    where: { username: 'qa_extreme_stores' },
    update: {
      password,
      role: 'STORES_MANAGER',
      roleId: storesRole.systemRole?.id ?? null,
      assignedStoreId: store.id,
      status: 'ACTIVE',
      accessibleOpmcs: { set: [{ id: storeOpmcId }] },
    },
    create: {
      username: 'qa_extreme_stores',
      email: 'qa_extreme_stores@slts.com',
      name: 'QA Extreme Stores Manager',
      password,
      role: 'STORES_MANAGER',
      roleId: storesRole.systemRole?.id ?? null,
      assignedStoreId: store.id,
      status: 'ACTIVE',
      accessibleOpmcs: { connect: [{ id: storeOpmcId }] },
    },
  });

  const contractor = await prisma.contractor.create({
    data: {
      name: `QA Extreme Contractor ${runId}`,
      registrationNumber: contractorRegistration,
      type: 'OSP',
      status: 'ACTIVE',
      email: `qa-extreme-contractor-${runId}@slts.com`,
      contactNumber: '0700000000',
      opmcId: storeOpmcId,
      documentStatus: 'APPROVED',
      kycVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'qa_extreme_contractor' },
    update: { password, contractorId: contractor.id, status: 'ACTIVE' },
    create: {
      username: 'qa_extreme_contractor',
      email: 'qa_extreme_contractor@slts.com',
      name: 'QA Extreme Contractor Supervisor',
      password,
      role: 'CONTRACTOR_SUPERVISOR',
      contractorId: contractor.id,
      status: 'ACTIVE',
    },
  });

  const baseline = await prisma.inventoryStock.findUniqueOrThrow({
    where: { storeId_itemId: { storeId: store.id, itemId: item.id } },
    select: { quantity: true, allocatedQuantity: true, minLevel: true },
  });

  if (Number(baseline.quantity) - Number(baseline.allocatedQuantity) - Number(baseline.minLevel) < quantityToIssue) {
    throw new Error(`Insufficient Kaduwela ATP for ${materialCode}`);
  }

  const projectType = await prisma.projectType.findFirstOrThrow({
    where: { name: 'SSD', workflowTemplates: { some: { isActive: true } } },
    select: { id: true },
  });

  const project = await ProjectService.createProject({
    projectCode,
    name: `QA Extreme Full Workflow ${runId}`,
    type: 'FTTH',
    contractorId: contractor.id,
    opmcId: storeOpmcId,
    projectTypeId: projectType.id,
    planningSource: 'CAD',
  });

  const assignment = await prisma.projectContractorAssignment.findFirstOrThrow({
    where: { projectId: project.id, contractorId: contractor.id },
  });

  const parentTask = await prisma.projectTask.create({
    data: {
      projectId: project.id,
      wbsCode: '1',
      name: 'QA Extreme Implementation Package',
      type: 'PARENT',
      status: 'COMPLETED',
      priority: 'HIGH',
      contractorId: contractor.id,
      contractorAssignmentId: assignment.id,
      plannedStartDate: now,
      plannedEndDate: now,
      actualStartDate: now,
      actualEndDate: now,
      plannedProgress: 100,
      actualProgress: 100,
      order: 1,
    },
  });

  const childTask = await prisma.projectTask.create({
    data: {
      projectId: project.id,
      parentId: parentTask.id,
      wbsCode: '1.1',
      name: 'Install and terminate fibre segment',
      type: 'TASK',
      status: 'COMPLETED',
      priority: 'HIGH',
      contractorId: contractor.id,
      contractorAssignmentId: assignment.id,
      plannedStartDate: now,
      plannedEndDate: now,
      actualStartDate: now,
      actualEndDate: now,
      plannedProgress: 100,
      actualProgress: 100,
      order: 1,
    },
  });

  const boqItem = await prisma.projectBOQItem.create({
    data: {
      projectId: project.id,
      itemCode: `QA-BOQ-${runId}`,
      description: item.name,
      unit: item.unit,
      quantity: quantityToIssue,
      unitRate: 1250,
      amount: quantityToIssue * 1250,
      category: 'MATERIAL',
      source: 'QA_SEED',
      materialId: item.id,
      taskId: childTask.id,
      contractorId: contractor.id,
      actualQuantity: quantityToIssue,
      actualCost: quantityToIssue * 1250,
    },
  });

  await prisma.bOQApproval.create({
    data: {
      boqId: randomUUID(),
      projectId: project.id,
      status: 'APPROVED',
      currentStep: 'COMPLETED',
      supervisorId: admin.id,
      supervisorApprovedAt: now,
      pmId: admin.id,
      pmApprovedAt: now,
      financeId: finance.id,
      financeApprovedAt: now,
      notes: 'QA extreme workflow seeded approval',
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'BOQ_APPROVED', budget: 25000 },
  });

  await prisma.surveyRequest.create({
    data: {
      projectId: project.id,
      requestNumber: surveyNumber,
      title: 'QA CAD survey and BOQ plan',
      description: 'Simulated completed field survey for browser E2E.',
      surveyType: 'CAD',
      status: 'COMPLETED',
      scheduledDate: now,
      completedDate: now,
      estimatedBOQ: quantityToIssue * 1250,
      finalBOQ: quantityToIssue * 1250,
      createdById: admin.id,
      approvedById: admin.id,
      approvedAt: now,
    },
  });

  const session = await prisma.mobileSurveySession.create({
    data: {
      projectId: project.id,
      supervisorId: admin.id,
      status: 'COMPLETED',
      pointsCount: 1,
      syncStatus: 'SYNCED',
      notes: 'QA mobile survey sync simulation',
      startedAt: now,
      completedAt: now,
    },
  });

  await prisma.surveyPoint.create({
    data: {
      sessionId: session.id,
      projectId: project.id,
      layerId: 'qa_survey_new_pole',
      layerName: 'QA Survey Point',
      latitude: 6.9271,
      longitude: 79.8612,
      attributes: { source: 'QA_SEED', cadFile: 'qa-extreme-plan.dwg' },
      supervisorId: admin.id,
      verificationStatus: 'APPROVED',
      verificationStep: 'COMPLETED',
      verifiedById: admin.id,
      verifiedAt: now,
      approvedById: admin.id,
      approvedAt: now,
    },
  });

  await prisma.projectDocument.create({
    data: {
      projectId: project.id,
      title: 'QA As-Built CAD Drawing',
      description: 'CAD-only as-built artifact; GIS is intentionally optional.',
      category: 'CAD_AS_BUILT',
      status: 'APPROVED',
      currentVersion: 1,
      fileUrl: `qa://project/${projectCode}/as-built.dwg`,
      uploadedById: admin.id,
    },
  });

  await ProjectMaterialReservationService.syncForProject(project.id);
  const requirement = await prisma.projectMaterialRequirement.findFirstOrThrow({ where: { projectId: project.id } });

  const allocation = await prisma.projectMaterialSupplyAllocation.create({
    data: {
      requirementId: requirement.id,
      sourceType: 'STORE',
      storeId: store.id,
      requestedQty: quantityToIssue,
      approvedQty: quantityToIssue,
      status: 'PLANNED',
      createdById: storeActor.id,
      notes: 'QA Kaduwela Store fulfilment',
    },
  });

  const reservationResult = await ProjectMaterialReservationService.reserve({
    projectId: project.id,
    storeId: store.id,
    userId: storeActor.id,
    requirementIds: [requirement.id],
    notes: 'QA extreme ATP reservation',
  });

  if (reservationResult.status !== 'RESERVED' || !reservationResult.reservation) {
    throw new Error(`Reservation did not complete: ${JSON.stringify(reservationResult)}`);
  }

  const issue = await ProjectStockIssueService.createIssueRequest({
    projectId: project.id,
    storeId: store.id,
    reservationId: reservationResult.reservation.id,
    requirementId: requirement.id,
    items: [{ itemId: item.id, quantity: quantityToIssue, remarks: 'QA task material issue' }],
    remarks: `QA extreme MIN for ${childTask.wbsCode}`,
    userId: storeActor.id,
  });

  await ProjectStockIssueService.approveIssueRequest(issue.id, admin.id);

  const finalPat = await prisma.pATSession.create({
    data: {
      projectId: project.id,
      patType: 'PRE_PAT',
      status: 'COMPLETED',
      sltOfficers: { officers: ['QA OSP Engineer'] },
      totalPoints: 1,
      passedPoints: 1,
      failedPoints: 0,
      passRate: 100,
      conductedById: admin.id,
      conductedAt: now,
      completedAt: now,
      notes: 'QA in-house PAT passed',
    },
  });

  await prisma.pATSession.create({
    data: {
      projectId: project.id,
      patType: 'SLT_PAT',
      status: 'COMPLETED',
      sltOfficers: { officers: ['QA SLT Officer'] },
      totalPoints: 1,
      passedPoints: 1,
      failedPoints: 0,
      passRate: 100,
      conductedById: finance.id,
      conductedAt: now,
      completedAt: now,
      notes: 'QA SLT PAT passed',
    },
  });

  const workflow = await prisma.projectWorkflowInstance.findUniqueOrThrow({
    where: { projectId: project.id },
    include: { stages: { orderBy: { sequence: 'asc' } } },
  });
  // updateMany avoids a Prisma client edge case seen on this deployment where
  // a singular stage update reported the parent table name in the error.
  await prisma.projectStageInstance.updateMany({
    where: { id: { in: workflow.stages.map((stage) => stage.id) } },
    data: { status: 'COMPLETED', actualStart: now, actualFinish: now },
  });
  const stageIds = workflow.stages.map((stage) => stage.id);
  if (stageIds.length > 0) {
    await prisma.projectTaskInstance.updateMany({ where: { stageId: { in: stageIds } }, data: { status: 'COMPLETED', progress: 100, actualStart: now, actualFinish: now } });
    await prisma.projectChecklistInstance.updateMany({ where: { stageId: { in: stageIds } }, data: { isCompleted: true } });
    await prisma.projectApprovalInstance.updateMany({ where: { stageId: { in: stageIds } }, data: { status: 'APPROVED', approvedById: admin.id, approvedAt: now } });
  }
  const lastStage = workflow.stages.at(-1);
  if (lastStage) {
    await prisma.projectWorkflowInstance.updateMany({ where: { id: workflow.id }, data: { currentStageId: lastStage.id } });
  }

  const invoice = await prisma.projectInvoice.create({
    data: {
      invoiceNumber,
      projectId: project.id,
      contractorId: contractor.id,
      title: 'QA Extreme Contractor Invoice',
      description: 'Simulated implementation invoice after PAT and as-built submission.',
      status: 'COMPLETED',
      type: 'CONTRACTOR',
      invoiceDate: now,
      dueDate: now,
      subtotal: 25000,
      totalAmount: 25000,
      paidAmount: 25000,
      balanceAmount: 0,
      currency: 'LKR',
      notes: 'QA invoice follow-up completed',
      followUpAt: now,
      followUpNotes: 'QA finance follow-up completed and paid.',
      completedAt: now,
      referenceNumber: `QA-REF-${runId}`,
      createdById: finance.id,
      approvedById: admin.id,
      approvedAt: now,
      items: {
        create: [{
          description: 'Implementation and commissioning',
          quantity: 1,
          unitPrice: 25000,
          totalPrice: 25000,
          boqItemId: boqItem.id,
          taskId: childTask.id,
          itemType: 'SERVICE',
        }],
      },
    },
  });

  await prisma.paymentVoucher.create({
    data: {
      pvNumber: paymentNumber,
      projectId: project.id,
      invoiceId: invoice.id,
      title: 'QA Extreme Payment Voucher',
      description: 'QA completed payment simulation',
      status: 'COMPLETED',
      type: 'CONTRACTOR',
      expenditureType: 'OPEX',
      payeeName: contractor.name,
      payeeId: contractor.id,
      amount: 25000,
      paymentDate: now,
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: paymentNumber,
      netAmount: 25000,
      createdById: finance.id,
      approvedById: admin.id,
      approvedAt: now,
      paidById: finance.id,
      paidAt: now,
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: 'COMPLETED',
      progress: 100,
      endDate: now,
      actualDuration: 1,
      actualCost: 12500,
      variance: 12500,
    },
  });

  const [afterStock, finalRequirement, finalReservation, finalAllocation, ledger, finalProject] = await Promise.all([
    prisma.inventoryStock.findUniqueOrThrow({ where: { storeId_itemId: { storeId: store.id, itemId: item.id } } }),
    prisma.projectMaterialRequirement.findUniqueOrThrow({ where: { id: requirement.id } }),
    prisma.projectMaterialReservation.findUniqueOrThrow({ where: { id: reservationResult.reservation.id } }),
    prisma.projectMaterialSupplyAllocation.findUniqueOrThrow({ where: { id: allocation.id } }),
    prisma.inventoryLedger.findMany({
      where: {
        referenceType: 'StockIssue',
        referenceId: issue.issueNumber,
        idempotencyKey: { startsWith: `PROJECT_ISSUE:${issue.id}:` },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.findUniqueOrThrow({ where: { id: project.id }, select: { id: true, projectCode: true, status: true, progress: true } }),
  ]);

  const expectedAfter = Number(baseline.quantity) - quantityToIssue;
  const checks = {
    stockDecreasedByIssue: Number(afterStock.quantity) === expectedAfter,
    allocatedReleasedAfterIssue: Number(afterStock.allocatedQuantity) === Number(baseline.allocatedQuantity),
    reservationConsumed: finalReservation.status === 'CONSUMED',
    requirementIssued: Number(finalRequirement.issuedQty) === quantityToIssue,
    requirementCompleted: finalRequirement.status === 'COMPLETED',
    supplyIssued: Number(finalAllocation.issuedQty) === quantityToIssue && finalAllocation.status === 'ISSUED',
    immutableLedgerWritten: ledger.length === 1 && Boolean(ledger[0]?.checksum),
    patPassed: finalPat.status === 'PASSED',
    invoiceCompleted: invoice.status === 'COMPLETED' && Number(invoice.balanceAmount) === 0,
    projectCompleted: finalProject.status === 'COMPLETED' && Number(finalProject.progress) === 100,
  };

  console.log(JSON.stringify({
    testKey: projectCode,
    projectId: project.id,
    projectCode,
    urls: {
      project: `/projects/${project.id}`,
      projectMaterials: '/inventory/project-materials',
      stockIssues: '/inventory/issues',
      invoices: '/finance/invoices',
    },
    accounts: {
      storesManager: { username: 'qa_extreme_stores', password: 'Test@123' },
      admin: { username: 'qa_admin', password: 'Test@123' },
      finance: { username: 'qa_finance', password: 'Test@123' },
    },
    material: { code: item.code, quantityIssued: quantityToIssue },
    stock: { before: Number(baseline.quantity), after: Number(afterStock.quantity), expectedAfter },
    reservation: { id: reservationResult.reservation.id, status: finalReservation.status },
    issue: { id: issue.id, issueNumber: issue.issueNumber, status: (await prisma.stockIssue.findUniqueOrThrow({ where: { id: issue.id } })).status },
    requirement: { id: requirement.id, status: finalRequirement.status, issuedQty: Number(finalRequirement.issuedQty) },
    invoice: { id: invoice.id, invoiceNumber, status: invoice.status, balance: Number(invoice.balanceAmount) },
    ledger: ledger.map((entry) => ({ id: entry.id, referenceId: entry.referenceId, quantityChange: Number(entry.quantityChange), quantityAfter: Number(entry.quantityAfter), checksum: entry.checksum })),
    checks,
    allChecksPassed: Object.values(checks).every(Boolean),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
