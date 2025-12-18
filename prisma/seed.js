const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    // Initialize Admin
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            role: 'SUPER_ADMIN',
            password: hashedPassword,
        },
        create: {
            username: 'admin',
            email: 'admin@nexuserp.com',
            password: hashedPassword,
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
        },
    });

    console.log('Super Admin initialized:', admin.username);

    // Initialize OPMCs
    const opmcColombo = await prisma.oPMC.upsert({
        where: { code: 'OPMC-COL-01' },
        update: {},
        create: {
            name: 'Colombo Central OPMC',
            code: 'OPMC-COL-01',
            area: 'Colombo East/West',
        },
    });

    console.log('OPMCs initialized');

    // Initialize some Staff hierarchy
    const manager = await prisma.staff.upsert({
        where: { employeeId: 'MGR001' },
        update: {},
        create: {
            name: 'John Manager',
            employeeId: 'MGR001',
            designation: 'MANAGER',
            area: 'Head Office',
        },
    });

    const areaManager = await prisma.staff.upsert({
        where: { employeeId: 'AM001' },
        update: {},
        create: {
            name: 'Dilshan AreaMgr',
            employeeId: 'AM001',
            designation: 'AREA_MANAGER',
            area: 'Colombo East',
            reportsToId: manager.id,
        },
    });

    console.log('Staff hierarchy initialized');

    // Initialize some Materials
    await prisma.material.upsert({
        where: { code: 'CABLE-FIBER-01' },
        update: {},
        create: {
            code: 'CABLE-FIBER-01',
            name: 'Fiber Optic Cable 48F',
            unit: 'm',
            quantity: 5000,
        },
    });

    await prisma.material.upsert({
        where: { code: 'JOINT-CLOSURE-01' },
        update: {},
        create: {
            code: 'JOINT-CLOSURE-01',
            name: 'Fiber Joint Closure',
            unit: 'nos',
            quantity: 100,
        },
    });

    console.log('Materials initialized');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
