import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(
  async (req, params) => {
    const { id } = await params;

    // Fetch all logs concurrently to minimize latency
    const [handovers, auditLogs, syncLogs] = await Promise.all([
      prisma.assetHandoverLog.findMany({
        where: { assetId: id },
        include: {
          performedBy: { select: { name: true, username: true } },
          targetStaff: { select: { name: true, employeeId: true } }
        },
        orderBy: { date: 'desc' }
      }),
      prisma.auditLog.findMany({
        where: {
          entity: "ITAsset",
          entityId: id
        },
        include: {
          user: { select: { name: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.assetSyncLog.findMany({
        where: { assetId: id },
        orderBy: { syncedAt: 'desc' }
      })
    ]);

    // Map handover logs
    const mappedHandovers = handovers.map(h => ({
      id: h.id,
      type: "HANDOVER",
      timestamp: h.date,
      title: `Custody ${h.transactionType === "ISSUED_TO_USER" ? "Issue" : h.transactionType === "RETURNED_TO_STORE" ? "Return" : "Exchange"}`,
      description: h.targetStaff
        ? `Device ${h.transactionType === "ISSUED_TO_USER" ? "handed over to" : h.transactionType === "RETURNED_TO_STORE" ? "returned from" : "exchanged with"} ${h.targetStaff.name} (EPF: ${h.targetStaff.employeeId}).`
        : `Custody changed (${h.transactionType}).`,
      user: h.performedBy ? { name: h.performedBy.name, username: h.performedBy.username } : null,
      meta: {
        condition: h.condition,
        remarks: h.remarks,
        transactionType: h.transactionType
      }
    }));

    // Map system audit logs
    const mappedAudit = auditLogs.map(a => {
      let desc = `Asset details modified.`;
      if (a.action === "CREATE") {
        desc = "Asset registered in system.";
      } else if (a.action === "DELETE") {
        desc = "Asset deleted from inventory.";
      } else if (a.action === "UPDATE" && a.newValue && typeof a.newValue === 'object') {
        const oldVal = a.oldValue && typeof a.oldValue === 'object' ? (a.oldValue as Record<string, any>) : {};
        const newVal = a.newValue as Record<string, any>;
        const changes: string[] = [];
        
        // Compare keys to show specific changes
        for (const key of Object.keys(newVal)) {
          if (key === 'updatedAt' || key === 'lastSyncedAt') continue;
          if (JSON.stringify(newVal[key]) !== JSON.stringify(oldVal[key])) {
            const displayOld = oldVal[key] !== undefined && oldVal[key] !== null ? String(oldVal[key]) : "empty";
            const displayNew = newVal[key] !== undefined && newVal[key] !== null ? String(newVal[key]) : "empty";
            // Make key more readable
            const cleanKey = key.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
            changes.push(`${cleanKey}: "${displayOld}" ➜ "${displayNew}"`);
          }
        }
        if (changes.length > 0) {
          desc = `Updated fields: ${changes.join(", ")}`;
        }
      }

      return {
        id: a.id,
        type: "SYSTEM_UPDATE",
        timestamp: a.createdAt,
        title: `System ${a.action.charAt(0).toUpperCase() + a.action.slice(1).toLowerCase()}`,
        description: desc,
        user: a.user ? { name: a.user.name, username: a.user.username } : null,
        meta: {
          ipAddress: a.ipAddress,
          userAgent: a.userAgent
        }
      };
    });

    // Map agent sync logs
    const mappedSync = syncLogs.map(s => ({
      id: `sync-${s.id}`,
      type: "AGENT_SYNC",
      timestamp: s.syncedAt,
      title: "Automated Specifications Sync",
      description: `Hardware & software synced from reported employee username "${s.reportedEmployeeUsername || '—'}" (EPF: ${s.reportedEmployeeNumber || '—'}) on IP ${s.ipAddress || '—'}.`,
      user: null,
      meta: {
        ipAddress: s.ipAddress,
        employeeNo: s.reportedEmployeeNumber,
        username: s.reportedEmployeeUsername
      }
    }));

    // Combine and sort (newest first)
    const timeline = [...mappedHandovers, ...mappedAudit, ...mappedSync].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return timeline;
  },
  {
    roles: ["SUPER_ADMIN", "ADMIN", "ENGINEER", "STORE_KEEPER", "OFFICE_ADMIN", "OFFICE_ADMIN_ASSISTANT"]
  }
);
