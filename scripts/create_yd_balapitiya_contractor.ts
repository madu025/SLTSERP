import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createYDBalapitiyaContractor() {
    console.log('🚀 === CREATING CONTRACTOR CREDENTIALS FOR Y D BALAPITIYA ===\n');

    const contractorName = "Y D Balapitiya";
    const contractorCode = "SLTS/OSP/2025/2026-398";
    const contactPhone = "0781148142";
    const username = "yd.balapitiya";
    const plainPassword = "SLTS#Balapitiya2026";
    const email = "yd.balapitiya@sltserp.lk";

    // 1. Create or Update Contractor Record
    let contractor = await prisma.contractor.findFirst({
        where: {
            OR: [
                { name: contractorName },
                { registrationNumber: contractorCode }
            ]
        }
    });

    if (!contractor) {
        contractor = await prisma.contractor.create({
            data: {
                name: contractorName,
                registrationNumber: contractorCode,
                contactNumber: contactPhone,
                status: 'ACTIVE',
            }
        });
        console.log(`✅ Step 1: Created New Contractor Record:`);
    } else {
        contractor = await prisma.contractor.update({
            where: { id: contractor.id },
            data: {
                name: contractorName,
                registrationNumber: contractorCode,
                contactNumber: contactPhone,
                status: 'ACTIVE'
            }
        });
        console.log(`✅ Step 1: Updated Existing Contractor Record:`);
    }

    console.log(`   - ID: ${contractor.id}`);
    console.log(`   - Name: ${contractor.name}`);
    console.log(`   - Registration Number: ${contractor.registrationNumber}`);
    console.log(`   - Phone: ${contractor.contactNumber}\n`);

    // 2. Create or Update User Login Account
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: username },
                { email: email },
                { contractorId: contractor.id }
            ]
        }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username,
                email,
                name: contractorName,
                password: hashedPassword,
                role: 'CONTRACTOR_SUPERVISOR',
                status: 'active',
                contractorId: contractor.id,
            }
        });
        console.log(`✅ Step 2: Created New User Login Account:`);
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                username,
                email,
                name: contractorName,
                password: hashedPassword,
                role: 'CONTRACTOR_SUPERVISOR',
                status: 'active',
                contractorId: contractor.id,
            }
        });
        console.log(`✅ Step 2: Updated Existing User Login Account:`);
    }

    console.log(`   - User ID: ${user.id}`);
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Linked Contractor ID: ${user.contractorId}\n`);

    // 3. Populate Initial VMI Stock for Contractor
    const stockItems = await prisma.inventoryItem.findMany({ take: 5 });
    for (const item of stockItems) {
        const initialQty = item.code.includes('DW') || item.name.includes('Drop Wire') ? 350 : 10;
        await prisma.contractorStock.upsert({
            where: { contractorId_itemId: { contractorId: contractor.id, itemId: item.id } },
            update: { quantity: initialQty },
            create: { contractorId: contractor.id, itemId: item.id, quantity: initialQty }
        });
    }

    console.log(`✅ Step 3: Allocated Initial VMI Stock to ${contractorName}.\n`);

    console.log('🎉 === CONTRACTOR CREDENTIALS GENERATED SUCCESSFULLY ===');
    console.log('------------------------------------------------------');
    console.log(`📍 Login URL:  http://localhost:3000/contractor/login`);
    console.log(`👤 Username:   ${username}`);
    console.log(`🔑 Password:   ${plainPassword}`);
    console.log(`📞 Phone:      ${contactPhone}`);
    console.log(`📋 Code:       ${contractorCode}`);
    console.log('------------------------------------------------------\n');
}

createYDBalapitiyaContractor()
    .catch((e) => {
        console.error('❌ Error creating contractor:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
