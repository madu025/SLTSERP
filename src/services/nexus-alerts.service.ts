import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class NexusAlertsService {
  /**
   * Run background checks and write active warnings to the database
   */
  static async checkAndGenerateAlerts() {
    const today = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [
      lowStock,
      overdueInvoices,
      expiringBatches,
      overdueTasks
    ] = await Promise.all([
      // 1. Low stock items
      prisma.inventoryStock.findMany({
        where: { quantity: { lte: 10 } },
        include: { item: true, store: true }
      }),
      // 2. Overdue Contractor Invoices
      prisma.invoice.findMany({
        where: {
          status: { notIn: ['PAID', 'CANCELLED', 'REJECTED'] },
          dueDate: { lt: today }
        },
        include: { contractor: true }
      }),
      // 3. Expiring Batches (within 30 days)
      prisma.inventoryBatch.findMany({
        where: {
          expiryDate: { lte: thirtyDaysFromNow, gt: today }
        },
        include: { item: true }
      }),
      // 4. Overdue Tasks
      prisma.projectTask.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          plannedEndDate: { lt: today }
        },
        include: { project: true }
      })
    ]);

    const activeAlerts: Prisma.NexusAlertCreateInput[] = [];

    // Map Low Stock
    lowStock.forEach(s => {
      activeAlerts.push({
        title: `Low Stock: ${s.item.name}`,
        message: `Store "${s.store.name}" holds only ${s.quantity} units of ${s.item.name} (Min Level: ${s.minLevel || 10}).`,
        type: 'LOW_STOCK',
        priority: 'HIGH',
        link: '/inventory/dashboard'
      });
    });

    // Map Overdue Invoices
    overdueInvoices.forEach(i => {
      activeAlerts.push({
        title: `Overdue Invoice: ${i.invoiceNumber}`,
        message: `Invoice from ${i.contractor.name} for LKR ${i.totalAmount.toLocaleString()} is overdue since ${i.dueDate?.toLocaleDateString()}.`,
        type: 'OVERDUE_INVOICE',
        priority: 'CRITICAL',
        link: '/invoices'
      });
    });

    // Map Expiring Batches
    expiringBatches.forEach(b => {
      activeAlerts.push({
        title: `Expiring Batch: ${b.batchNumber}`,
        message: `Batch containing ${b.item.name} is expiring on ${b.expiryDate?.toLocaleDateString()}.`,
        type: 'EXPIRY',
        priority: 'HIGH',
        link: '/inventory/dashboard'
      });
    });

    // Map Overdue Tasks
    overdueTasks.forEach(t => {
      activeAlerts.push({
        title: `Delayed Task: ${t.name}`,
        message: `Task under project "${t.project.name}" was planned to end by ${t.plannedEndDate?.toLocaleDateString()} but remains incomplete.`,
        type: 'OVERDUE_TASK',
        priority: 'MEDIUM',
        link: `/projects/${t.projectId}/tasks`
      });
    });

    // Write to database, avoiding duplicates for identical active titles in a single batch operation
    if (activeAlerts.length > 0) {
      const activeTitles = activeAlerts.map(a => a.title);
      
      // Batch query existing unread alerts with matching titles
      const existingAlerts = await prisma.nexusAlert.findMany({
        where: {
          title: { in: activeTitles },
          isRead: false
        },
        select: { title: true }
      });
      
      const existingTitlesSet = new Set(existingAlerts.map(a => a.title));
      
      // Filter out duplicate active alerts
      const alertsToInsert = activeAlerts.filter(a => !existingTitlesSet.has(a.title));
      
      if (alertsToInsert.length > 0) {
        await prisma.nexusAlert.createMany({
          data: alertsToInsert
        });
      }
    }
  }

  /**
   * Fetch active, unread alerts
   */
  static async getUnreadAlerts() {
    return prisma.nexusAlert.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mark alert as read
   */
  static async markAlertAsRead(id: string) {
    return prisma.nexusAlert.update({
      where: { id },
      data: { isRead: true }
    });
  }

  /**
   * Mark all alerts as read
   */
  static async markAllAsRead() {
    return prisma.nexusAlert.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
  }
}
