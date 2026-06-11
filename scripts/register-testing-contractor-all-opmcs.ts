import { prisma } from '../src/lib/prisma';
import { eventBus } from '../src/lib/events/event-bus';
import { ContractorRegistrationService } from '../src/services/contractor/contractor.registration.service';
import { ContractorLifecycleService } from '../src/services/contractor/contractor.lifecycle.service';

async function main() {
    console.log('=== Registering Testing Contractors for All OPMCs ===\n');

    // Mock eventBus.publish to prevent the script from hanging on Redis connections
    eventBus.publish = async (channel: string, data: any) => {
        console.log(`     [MOCK EVENT BUS] Published on channel: ${channel}`);
        return Promise.resolve();
    };

    // 1. Get a valid site office staff/admin user to link as siteOfficeStaffId, armApprovedById, and ospApprovedById
    const adminUser = await prisma.user.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'OFFICE_ADMIN'] } }
    });
    
    if (!adminUser) {
        console.error('❌ No admin/super-admin user found in database. Cannot proceed.');
        return;
    }
    
    console.log(`Using Admin User: ${adminUser.username} (ID: ${adminUser.id}) for approvals\n`);

    // 2. Fetch all OPMCs
    const opmcs = await prisma.oPMC.findMany({
        orderBy: { rtom: 'asc' }
    });

    console.log(`Found ${opmcs.length} OPMCs in the database.\n`);

    let count = 0;

    for (let i = 0; i < opmcs.length; i++) {
        const opmc = opmcs[i];
        const contractorName = `Testing Contractor - ${opmc.rtom}`;
        
        // Clean up any existing testing contractor for this OPMC to make the script fully idempotent and re-runnable
        const existing = await prisma.contractor.findFirst({
            where: { name: contractorName }
        });

        if (existing) {
            console.log(`[${opmc.rtom}] Cleaning up existing contractor: "${contractorName}" (ID: ${existing.id})...`);
            await prisma.teamMember.deleteMany({ where: { contractorId: existing.id } });
            await prisma.contractorTeam.deleteMany({ where: { contractorId: existing.id } });
            await prisma.contractor.delete({ where: { id: existing.id } });
            console.log(`     Cleanup done.`);
        }

        console.log(`[${opmc.rtom}] Processing Registration Flow for "${contractorName}"...`);

        // Suffix using i to ensure unique contact/NIC/BR across all 43 OPMCs
        const suffix = i.toString().padStart(3, '0');
        const contactNumber = `+94771234${suffix}`;
        const email = `test.contractor.${opmc.rtom.toLowerCase()}@sltserp.lk`;
        const nic = `200000000${suffix}`;
        const brNumber = `PV-TEST-${opmc.rtom}-${suffix}`;

        try {
            // STEP 1: Generate registration link (PENDING state)
            console.log(`  -> STEP 1: Generating Invite Link...`);
            const inviteResult = await ContractorRegistrationService.generateRegistrationLink({
                name: contractorName,
                contactNumber,
                email,
                type: 'SOD',
                siteOfficeStaffId: adminUser.id,
                opmcId: opmc.id,
                origin: 'http://localhost:3000'
            });

            const token = inviteResult.contractor.registrationToken;
            if (!token) {
                throw new Error('Failed to generate registration token');
            }
            console.log(`     Link: ${inviteResult.registrationLink} | Token: ${token}`);

            // STEP 2: Submit Public Registration (ARM_PENDING state)
            console.log(`  -> STEP 2: Submitting Public Registration details...`);
            
            const submitData = {
                name: contractorName,
                contactNumber,
                email,
                nic,
                address: `No. ${suffix}, Main Street, OPMC ${opmc.rtom}`,
                brNumber,
                bankName: 'Bank of Ceylon',
                bankBranch: `${opmc.rtom} Branch`,
                bankAccountNumber: `1000000${suffix}`,
                bankPassbookUrl: 'https://example.com/passbook.pdf',
                photoUrl: 'https://example.com/photo.jpg',
                nicFrontUrl: 'https://example.com/nic-front.jpg',
                nicBackUrl: 'https://example.com/nic-back.jpg',
                policeReportUrl: 'https://example.com/police-report.pdf',
                gramaCertUrl: 'https://example.com/grama-cert.pdf',
                brCertUrl: 'https://example.com/br-cert.pdf',
                registrationFeeSlipUrl: 'https://example.com/fee-slip.jpg',
                teams: [
                    {
                        name: `Testing Team - ${opmc.rtom} 1`,
                        opmcId: opmc.id,
                        sltCode: `T-TEST-${opmc.rtom}-01`,
                        storeIds: opmc.storeId ? [opmc.storeId] : [],
                        primaryStoreId: opmc.storeId || undefined,
                        members: [
                            {
                                name: `Lead Tech - ${opmc.rtom}`,
                                nic: `199500000${suffix}`,
                                contactNumber: `+94779876${suffix}`,
                                address: `Tech Street, OPMC ${opmc.rtom}`,
                                designation: 'FIELD_ENGINEER',
                                photoUrl: 'https://example.com/m1.jpg'
                            }
                        ]
                    }
                ]
            };

            const submittedContractor = await ContractorRegistrationService.submitPublicRegistration(token, submitData);
            console.log(`     Status moved to: ${submittedContractor.status}`);

            // STEP 3: ARM Approval (OSP_PENDING state)
            console.log(`  -> STEP 3: Approving as Area Regional Manager...`);
            const armApproved = await ContractorLifecycleService.updateContractor(submittedContractor.id, {
                status: 'OSP_PENDING',
                armApprovedById: adminUser.id,
                armApprovedAt: new Date()
            });
            console.log(`     Status moved to: ${armApproved.status}`);

            // STEP 4: OSP Approval / Activation (ACTIVE state & sequence generation)
            console.log(`  -> STEP 4: Approving as OSP / Activating...`);
            const activeContractor = await ContractorLifecycleService.updateContractor(submittedContractor.id, {
                status: 'ACTIVE',
                ospApprovedById: adminUser.id,
                ospApprovedAt: new Date(),
                agreementSigned: true,
                agreementDate: new Date(),
                agreementDuration: 1,
                registrationFeePaid: true
            });
            
            console.log(`     Status moved to: ${activeContractor.status}`);
            console.log(`     🎉 Registered successfully! Reg No: ${activeContractor.registrationNumber}`);
            
            count++;
        } catch (err: any) {
            console.error(`  ❌ Error processing registration for ${opmc.rtom}:`, err.message || err);
        }
    }

    console.log(`\n=== Registration completed. Registered ${count} new Testing Contractors. ===`);
}

main()
    .catch((e) => {
        console.error('Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
