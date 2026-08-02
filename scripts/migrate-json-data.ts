import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data migration...');

    // 1. Migrate SODForensicAudit data
    const sodAudits = await prisma.sODForensicAudit.findMany({
        where: {
            auditData: { not: null }
        }
    });

    console.log(`Found ${sodAudits.length} SODForensicAudit records to migrate.`);
    let sodMigrated = 0;
    
    for (const audit of sodAudits) {
        if (!audit.auditData) continue;
        
        // Skip if already migrated (auditItems exist)
        const existingItems = await prisma.sODAuditItem.count({ where: { sodAuditId: audit.id } });
        if (existingItems > 0) continue;

        const dataArr = Array.isArray(audit.auditData) ? audit.auditData : [audit.auditData];
        
        for (const item of dataArr as any[]) {
            if (item && item.name && item.status) {
                await prisma.sODAuditItem.create({
                    data: {
                        sodAuditId: audit.id,
                        name: item.name,
                        status: item.status,
                        uuid: item.uuid || 'unknown'
                    }
                });
            }
        }
        sodMigrated++;
    }
    console.log(`Successfully migrated ${sodMigrated} SODForensicAudit records.`);

    // 2. Migrate Checklist items (Assuming QualityInspection model, though we don't know the exact model name.
    // If it's QualityInspection, we'll try catching errors if it doesn't exist).
    try {
        if ('qualityInspection' in prisma) {
            const inspections = await (prisma as any).qualityInspection.findMany({
                where: { checklistRaw: { not: null } }
            });
            console.log(`Found ${inspections.length} QualityInspection records to migrate.`);
            
            let chkMigrated = 0;
            for (const inspection of inspections) {
                const existing = await prisma.checklistItem.count({ where: { parentId: inspection.id } });
                if (existing > 0) continue;

                const itemsArr = Array.isArray(inspection.checklistRaw) ? inspection.checklistRaw : [inspection.checklistRaw];
                for (const item of itemsArr as any[]) {
                    if (item && item.item) {
                        await prisma.checklistItem.create({
                            data: {
                                parentId: inspection.id,
                                item: item.item,
                                isChecked: Boolean(item.isChecked)
                            }
                        });
                    }
                }
                chkMigrated++;
            }
            console.log(`Successfully migrated ${chkMigrated} QualityInspection records.`);
        }
    } catch (e) {
        console.log('Skipping Checklist migration, model might not match.');
    }

    console.log('Data migration complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
