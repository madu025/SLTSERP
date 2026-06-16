
import { prisma } from '../src/lib/prisma';
import { InvoiceQueryService } from '../src/services/invoice/invoice.query.service';

const testInvoiceFilters = async () => {
    console.log("🚀 Starting Invoice Filter Verification...");

    try {
        const contractor = await prisma.contractor.findFirst();
        if (!contractor) throw new Error("No Contractor found");

        const opmc = await prisma.oPMC.findFirst();
        if (!opmc) throw new Error("No OPMC found");

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        console.log(`✅ Using Contractor: ${contractor.name}, Period: ${month}/${year}`);

        // 1. Create Eligible SOD
        const eligibleSod = await prisma.serviceOrder.create({
            data: {
                soNum: `ELG-${Date.now()}`,
                contractorId: contractor.id,
                opmcId: opmc.id,
                sltsStatus: 'COMPLETED',
                sltsPatStatus: 'PASS',
                completedDate: now,
                invoiced: false,
                status: 'COMPLETED'
            }
        });

        // 2. Create Ineligible SOD (Failed PAT)
        const ineligibleSod = await prisma.serviceOrder.create({
            data: {
                soNum: `INELG-${Date.now()}`,
                contractorId: contractor.id,
                opmcId: opmc.id,
                sltsStatus: 'COMPLETED',
                sltsPatStatus: 'REJECTED',
                completedDate: now,
                invoiced: false,
                status: 'COMPLETED'
            }
        });

        // 3. RUN QUERY
        const results = await InvoiceQueryService.getEligibleSods(contractor.id, month, year);
        
        console.log(`📊 Found ${results.length} eligible SODs`);
        
        const hasEligible = results.some(r => r.id === eligibleSod.id);
        const hasIneligible = results.some(r => r.id === ineligibleSod.id);

        if (hasEligible && !hasIneligible) {
            console.log("✅ Filters correctly identified only PAT_PASS orders.");
        } else {
            console.log("❌ Filter logic failed!");
            console.log(`   Has Eligible: ${hasEligible}`);
            console.log(`   Has Ineligible: ${hasIneligible}`);
            throw new Error("Filter mismatch");
        }

        console.log("\n🎉 INVOICE FILTER VERIFICATION PASSED!");

    } catch (error) {
        console.error("\n❌ VERIFICATION FAILED:", error);
    } finally {
        await prisma.$disconnect();
    }
};

testInvoiceFilters();
