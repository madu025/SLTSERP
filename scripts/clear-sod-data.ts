import { prisma } from '../src/lib/prisma';

async function clearSodData() {
    console.log('Starting SOD & Extension Raw Data Database Truncation...');

    try {
        const d1 = await prisma.sODMaterialUsage.deleteMany({});
        console.log(`Deleted ${d1.count} SODMaterialUsage records.`);

        const d2 = await prisma.sODErectedPole.deleteMany({});
        console.log(`Deleted ${d2.count} SODErectedPole records.`);

        const d3 = await prisma.sODIptvSerial.deleteMany({});
        console.log(`Deleted ${d3.count} SODIptvSerial records.`);

        const d4 = await prisma.serviceOrderStatusHistory.deleteMany({});
        console.log(`Deleted ${d4.count} ServiceOrderStatusHistory records.`);

        const d5 = await prisma.serviceOrderComment.deleteMany({});
        console.log(`Deleted ${d5.count} ServiceOrderComment records.`);

        const d6 = await prisma.sODForensicAudit.deleteMany({});
        console.log(`Deleted ${d6.count} SODForensicAudit records.`);

        const d7 = await prisma.contractorMaterialReturn.deleteMany({}).catch(() => ({ count: 0 }));
        console.log(`Deleted ${d7.count} ContractorMaterialReturn records.`);

        const d8 = await prisma.collectedCPE.deleteMany({}).catch(() => ({ count: 0 }));
        console.log(`Deleted ${d8.count} CollectedCPE records.`);

        const d9 = await prisma.serviceOrder.deleteMany({});
        console.log(`Deleted ${d9.count} ServiceOrder records.`);

        const d10 = await prisma.extensionRawData.deleteMany({});
        console.log(`Deleted ${d10.count} ExtensionRawData records.`);

        console.log('SUCCESS: All Service Orders (SODs), Extension Raw Data, and related records cleared from database.');
    } catch (error) {
        console.error('Error clearing SOD & Extension data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearSodData();
