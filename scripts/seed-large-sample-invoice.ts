import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedLargeSampleInvoice() {
    console.log('🚀 Seeding Contractor Sample Invoice strictly for R-MD, R-HK & R-WT RTOMs...');

    // 1. Ensure Contractor exists
    let contractor = await prisma.contractor.findFirst({
        where: { name: { contains: 'LANKA OPTIC' } }
    });

    if (!contractor) {
        contractor = await prisma.contractor.create({
            data: {
                name: 'LANKA OPTIC TELECOM SERVICES (PVT) LTD',
                brNumber: 'PV-98273',
                registrationNumber: 'PV-98273',
                contactNumber: '+94 77 123 4567',
                email: 'billing@lankaoptic.lk',
                address: 'No. 45, Telecom Road, Colombo 03',
                bankName: 'Commercial Bank of Ceylon PLC',
                bankBranch: 'Main Street Branch, Colombo',
                bankAccountNumber: '8004920193'
            }
        });
    }

    // 2. Query specific OPMCs / RTOMs: R-MD, R-HK, R-WT from database
    const targetRtomCodes = ['R-MD', 'R-HK', 'R-WT'];
    const dbOpmcs = await prisma.oPMC.findMany({
        where: { rtom: { in: targetRtomCodes } },
        select: { id: true, rtom: true, name: true, region: true }
    });

    const allOpmcs = dbOpmcs.length > 0 ? dbOpmcs : await prisma.oPMC.findMany({
        select: { id: true, rtom: true, name: true, region: true }
    });

    // 3. Fetch inventory items for F1, G1, Rosette, FAC, Hooks, Bolts, Conduit, Casing
    const items = await prisma.inventoryItem.findMany({
        where: { isOspFtth: true }
    });

    const f1Item = items.find(i => i.code === 'OSP-HC-CBL-DW' || i.commonName === 'DROP WIRE' || i.name.includes('Drop Cable'));
    const g1Item = items.find(i => i.code === 'OSPFTA003' || i.name.includes('Indoor') || i.type !== 'SLT');
    const rosetteItem = items.find(i => i.code === 'OSPFTA007' || i.commonName === 'ROSETTE');
    const facItem = items.find(i => i.code === 'OSP-HC-ACC-FAC' || i.commonName === 'FAC CONNECTOR');
    const hookCItem = items.find(i => i.code === 'OSP-NC-MM-CHOOK' || i.commonName === 'HOOK C');
    const hookLItem = items.find(i => i.code === 'OSP-NC-MM-LHOOK' || i.commonName === 'HOOK L');
    const boltItem = items.find(i => i.code === 'OSPACC011' || i.commonName === 'BOLT & NUTS');
    const conduitItem = items.find(i => i.commonName === 'CONDUIT' || i.name.toLowerCase().includes('conduit'));
    const casingItem = items.find(i => i.commonName === 'CASING' || i.name.toLowerCase().includes('casing'));

    // 4. Create 20 Completed SODs strictly assigned to R-MD, R-HK, and R-WT RTOMs
    const sodIds: string[] = [];
    let grandTotalAmount = 0;

    const packages = ['FIBER TRIPLE PLAY', 'FIBER DOUBLE PLAY', 'FIBER BROADBAND 100M', 'FIBER GAMING UNLIMITED'];

    for (let i = 1; i <= 20; i++) {
        const ts = Date.now().toString().slice(-4);
        const soNum = `SOD-2026-${ts}-${(1000 + i).toString()}`;
        const voiceNum = `0112${(850000 + i).toString()}`;
        
        // Strictly rotate through R-MD (Maharagama), R-HK (Havelock), R-WT (Wattala)
        const chosenOpmc = allOpmcs[(i - 1) % allOpmcs.length];
        const chosenRtom = chosenOpmc.rtom; 
        const chosenPackage = packages[i % packages.length];

        const f1Meters = 75 + (i * 15) % 210; // 75m to 285m
        const g1Meters = 12 + (i * 4) % 30;   // 12m to 42m
        const rosetteQty = 1;
        const facQty = 2;
        const hookCQty = 1 + (i % 2);
        const hookLQty = i % 3 === 0 ? 1 : 0;
        const boltQty = 2 + (i % 2);
        const conduitQty = i % 2 === 0 ? 1 : 0;
        const casingQty = i % 3 === 0 ? 2 : 0;

        // Approximate rate per SOD: Base connection Rs 12,500 + meterage + poles
        const sodRate = 12500 + (f1Meters * 35) + (g1Meters * 45) + (hookCQty * 150) + (boltQty * 200);
        grandTotalAmount += sodRate;

        // Create SOD with material usage
        const sod = await prisma.serviceOrder.create({
            data: {
                soNum,
                opmcId: chosenOpmc.id,
                voiceNumber: voiceNum,
                rtom: chosenRtom,
                status: 'COMPLETED',
                sltsStatus: 'COMPLETED',
                serviceType: 'FTTH_NEW_CONNECTION',
                package: chosenPackage,
                contractorId: contractor.id,
                completedDate: new Date(2026, 6, 10 + (i % 12)),
                comments: `FTTH Connection Completed Successfully at RTOM ${chosenRtom} (${chosenOpmc.name}). Voice: ${voiceNum}. All materials verified.`,
                materialUsage: {
                    create: [
                        ...(f1Item ? [{ itemId: f1Item.id, quantity: f1Meters, unit: 'MTR', usageType: 'PORTAL_SYNC' }] : []),
                        ...(g1Item ? [{ itemId: g1Item.id, quantity: g1Meters, unit: 'MTR', usageType: 'USED_G1' }] : []),
                        ...(rosetteItem ? [{ itemId: rosetteItem.id, quantity: rosetteQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(facItem ? [{ itemId: facItem.id, quantity: facQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(hookCItem ? [{ itemId: hookCItem.id, quantity: hookCQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(hookLItem && hookLQty > 0 ? [{ itemId: hookLItem.id, quantity: hookLQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(boltItem ? [{ itemId: boltItem.id, quantity: boltQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(conduitItem && conduitQty > 0 ? [{ itemId: conduitItem.id, quantity: conduitQty, unit: 'NOS', usageType: 'USED' }] : []),
                        ...(casingItem && casingQty > 0 ? [{ itemId: casingItem.id, quantity: casingQty, unit: 'NOS', usageType: 'USED' }] : [])
                    ]
                }
            }
        });

        sodIds.push(sod.id);
    }

    // 5. Create Penalty Records
    const penaltiesList = [
        { amount: 2500, reason: 'SLA Delay Penalty', description: 'SOD completed after 48h SLA window threshold at R-MD' },
        { amount: 1500, reason: 'Safety Violation', description: 'Missing safety helmet notice on R-HK site audit' }
    ];
    const penaltyTotal = 4000;

    // 6. Generate Regional Contractor Invoice
    const year = 2026;
    const month = 7;
    const regClean = 'METRO';
    const pattern = `INV/LOTS/${regClean}/26/07-`;

    const latestInvoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: pattern } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true }
    });

    let nextSeq = 1;
    if (latestInvoice) {
        const parts = latestInvoice.invoiceNumber.split('-');
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    const invoiceNumber = `${pattern}${nextSeq.toString().padStart(3, '0')}`;

    // Calculate split A & B amounts
    const amountA = Math.round((grandTotalAmount - penaltyTotal) * 0.70);
    const amountB = Math.round((grandTotalAmount - penaltyTotal) * 0.30);

    const invoice = await prisma.invoice.create({
        data: {
            invoiceNumber,
            contractorId: contractor.id,
            year,
            month,
            rtomArea: 'METRO',
            totalAmount: grandTotalAmount,
            amount: grandTotalAmount,
            amountA,
            amountB,
            status: 'PENDING_SF_AUDIT',
            statusA: 'PENDING',
            statusB: 'PENDING',
            description: `Monthly FTTH Installation Claim for July 2026 - R-MD, R-HK & R-WT RTOMs`,
            sods: {
                connect: sodIds.map(id => ({ id }))
            },
            penalties: {
                create: penaltiesList.map(p => ({
                    amount: p.amount,
                    reason: p.reason,
                    description: p.description
                }))
            }
        }
    });

    console.log(`✅ R-MD, R-HK & R-WT Sample Invoice Created Successfully!`);
    console.log(`   Invoice ID: ${invoice.id}`);
    console.log(`   Invoice No: ${invoiceNumber}`);
    console.log(`   Target RTOMs: R-MD (Maharagama), R-HK (Havelock), R-WT (Wattala)`);
    console.log(`   Total SODs: 20 | Total Claim: Rs. ${grandTotalAmount.toLocaleString()} | Net Payable: Rs. ${(grandTotalAmount - penaltyTotal).toLocaleString()}`);
    console.log(`   URL: http://localhost:3000/public/invoices/${invoice.id}`);

    return { invoice, contractor, sodCount: sodIds.length, grandTotalAmount };
}

seedLargeSampleInvoice()
    .catch((e) => {
        console.error('❌ Error seeding sample invoice:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
