const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    // ⚠️ WARNING: REMOVE ALL TEST USERS BEFORE PRODUCTION DEPLOYMENT ⚠️
    // These are for TESTING PURPOSES ONLY

    // Initialize Super Admin
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

    // 🧪 TEST USERS - All use password: Admin@123
    // ⚠️ DELETE THESE BEFORE PRODUCTION! ⚠️

    const testUsers = [
        {
            username: 'testadmin',
            email: 'testadmin@test.com',
            name: 'Test Admin',
            role: 'ADMIN'
        },
        {
            username: 'ospmanager',
            email: 'osp@test.com',
            name: 'Test OSP Manager',
            role: 'OSP_MANAGER'
        },
        {
            username: 'areamanager',
            email: 'area@test.com',
            name: 'Test Area Manager',
            role: 'AREA_MANAGER'
        },
        {
            username: 'storesmanager',
            email: 'stores@test.com',
            name: 'Test Stores Manager',
            role: 'STORES_MANAGER'
        },
        {
            username: 'coordinator',
            email: 'coordinator@test.com',
            name: 'Test Area Coordinator',
            role: 'AREA_COORDINATOR'
        },
        {
            username: 'qcofficer',
            email: 'qc@test.com',
            name: 'Test QC Officer',
            role: 'QC_OFFICER'
        }
    ];

    console.log('Creating test users...');
    for (const testUser of testUsers) {
        await prisma.user.upsert({
            where: { username: testUser.username },
            update: {
                role: testUser.role,
                password: hashedPassword,
            },
            create: {
                username: testUser.username,
                email: testUser.email,
                password: hashedPassword,
                name: testUser.name,
                role: testUser.role,
            },
        });
        console.log(`Test user created: ${testUser.username} (${testUser.role})`);
    }
    console.log('⚠️  Remember to remove test users before production! ⚠️');

    // Initialize OPMCs (Full List)
    const opmcs = [
        { region: "METRO", province: "METRO 01", rtom: "R-HK" },
        { region: "METRO", province: "METRO 01", rtom: "R-KX" },
        { region: "METRO", province: "METRO 01", rtom: "R-MD" },
        { region: "METRO", province: "METRO 02", rtom: "R-HO" },
        { region: "METRO", province: "METRO 02", rtom: "R-ND" },
        { region: "METRO", province: "METRO 02", rtom: "R-RM" },
        { region: "REGION 01", province: "CP", rtom: "R-GP" },
        { region: "REGION 01", province: "CP", rtom: "R-HT" },
        { region: "REGION 01", province: "CP", rtom: "R-KY" },
        { region: "REGION 01", province: "CP", rtom: "R-MT" },
        { region: "REGION 01", province: "CP", rtom: "R-NW" },
        { region: "REGION 01", province: "NWP", rtom: "R-CW" },
        { region: "REGION 01", province: "NWP", rtom: "R-KG" },
        { region: "REGION 01", province: "NWP", rtom: "R-KLY" },
        { region: "REGION 01", province: "WPN", rtom: "R-GQ" },
        { region: "REGION 01", province: "WPN", rtom: "R-KI" },
        { region: "REGION 01", province: "WPN", rtom: "R-NG" },
        { region: "REGION 01", province: "WPN", rtom: "R-NTB" },
        { region: "REGION 01", province: "WPN", rtom: "R-WT" },
        { region: "REGION 02", province: "UVA", rtom: "R-BD" },
        { region: "REGION 02", province: "UVA", rtom: "R-BW" },
        { region: "REGION 02", province: "UVA", rtom: "R-KE" },
        { region: "REGION 02", province: "SAB", rtom: "R-MRG" },
        { region: "REGION 02", province: "SAB", rtom: "R-RN" },
        { region: "REGION 02", province: "SP", rtom: "R-GL" },
        { region: "REGION 02", province: "SP", rtom: "R-HB" },
        { region: "REGION 02", province: "SP", rtom: "R-EMB" },
        { region: "REGION 02", province: "SP", rtom: "R-MH" },
        { region: "REGION 02", province: "WPS", rtom: "R-AG" },
        { region: "REGION 02", province: "WPS", rtom: "R-HR" },
        { region: "REGION 02", province: "WPS", rtom: "R-KT" },
        { region: "REGION 02", province: "WPS", rtom: "R-PH" },
        { region: "REGION 03", province: "EP", rtom: "R-AP" },
        { region: "REGION 03", province: "EP", rtom: "R-BC" },
        { region: "REGION 03", province: "EP", rtom: "R-KL" },
        { region: "REGION 03", province: "EP", rtom: "R-PR" },
        { region: "REGION 03", province: "EP", rtom: "R-TC" },
        { region: "REGION 03", province: "NP", rtom: "R-AD" },
        { region: "REGION 03", province: "NP", rtom: "R-JA" },
        { region: "REGION 03", province: "NP", rtom: "R-KO" },
        { region: "REGION 03", province: "NP", rtom: "R-MB" },
        { region: "REGION 03", province: "NP", rtom: "R-VA" },
        { region: "REGION 03", province: "NP", rtom: "R-MLT" }
    ];

    console.log('Seeding OPMCs...');

    for (const opmc of opmcs) {
        await prisma.oPMC.upsert({
            where: { rtom: opmc.rtom },
            update: {
                region: opmc.region,
                province: opmc.province
            },
            create: {
                name: `OPMC ${opmc.rtom}`,
                rtom: opmc.rtom,
                region: opmc.region,
                province: opmc.province
            },
        });
    }

    console.log('OPMCs initialized');

    // Initialize Stores
    const stores = [
        { name: "Nittambuwa Store", location: "No. 67/2/1, Webadagalla, Kiridiwela Rd. Nittambuwa", contact: "Mr. Ravindu" },
        { name: "Kaduwela Store", location: "No. 148/2/A, Kandy Road, Bandarawatta, Biyagama", contact: "Mr. Kasun" },
        { name: "Homagama Store", location: "No. 540/2, Highlevel Rd. Galawilawatta, Homagama", contact: "Mr. Tharaka" },
        { name: "Nuwaraeliya Store", location: "No. 170/6. Vijithpura, Mahagasthota, Nuwaraeliya", contact: "Mr. Tharidu" },
        { name: "Anuradhapura Store", location: "Walawwatta, Anuradhapura", contact: "Mr. Rajitha" },
        { name: "Polonnaruwa Store", location: "No. 66,Track 12, Jayanthipura,Polonnaruwa", contact: "Mr. Shan" },
        { name: "Chilaw Store", location: "Rajakadaluwa,Arachchikattuwa, Chilaw", contact: "Mr. Harsha" },
        { name: "Kurunegala Store", location: "No. 202, Gattuwana Road, Kurunegala", contact: "Mr. Kanchana" },
        { name: "Matale Store", location: "Dewala Road, Ukuwela", contact: "Mr. Nishantha" },
        { name: "Gelioya Store", location: "No. 217, Hilside, Godapola, Gelioya", contact: "Mr. Chandana" },
        { name: "Negombo Store", location: "Plot - 03, Base Line Rd,K C De Silva pura, Thibirigaskaduwa", contact: "Mr. Anuranga" },
        { name: "Bandarawela Store", location: "Sharmali Niwasa, Abegoda, Welimada Rd. Banadarawela", contact: "Mr. Lanka" },
        { name: "Moneragala Store", location: "1st Mile Post, Wedikumbura Road, Monaragala", contact: "Mr. Lanka" },
        { name: "Galle Store", location: "No. 15, Pawlas Mw, Kandewatta, Galle", contact: "Mr. Shanel" },
        { name: "Hambantota Store", location: "No. 246/1, Thissa Road,Weliyara,Netolpitiya, Hambanthota", contact: "Mr. Hashan" },
        { name: "Matara Store", location: "No. 19/2A, Kithulawela, Walapola, Matara", contact: "Mr. Nilanka" },
        { name: "Kalutara Store", location: "No.36, Siri Niwansa Mawatha, Kaluthara, North", contact: "Mr. Buddika" },
        { name: "Bandaragama Store", location: "1st Floor, Sri Lanka Telecom PLC,Panadura Road, Bandaragama", contact: "Mr. Harshana" },
        { name: "Kegalle Store", location: "No. 127/4, Karadupona, Kegalle", contact: "Mr. Thushantha" },
        { name: "Ratnapura Store", location: "No. 75/5, Ellawala Mawatha, Batu gedara, Rathnapura", contact: "Mr. Thushantha" },
        { name: "Jaffna Store", location: "SLT premisses", contact: "Mr. Enojan" },
        { name: "Vavuniya Store", location: "SLT premisses", contact: "Mr. Milan" },
        { name: "Samanthurei Store", location: "SLT Exgange, Main Road, Sammanthurai", contact: "Mr. Shabri" },
        { name: "Baticaloa Store", location: "SLT Exgange, Eravur,Batticaloa", contact: "Mr. Enojan" },
        { name: "Trincomalee Store", location: "No.85, Thirukkadaloor, Trincomalee", contact: "Mr. Enojan" }
    ];

    console.log('Seeding Stores...');

    for (const store of stores) {
        // Check if store exists by name
        const existingStore = await prisma.inventoryStore.findFirst({
            where: { name: store.name }
        });

        if (!existingStore) {
            await prisma.inventoryStore.create({
                data: {
                    name: store.name,
                    location: store.location,
                    type: 'SUB',
                }
            });
        }
    }
    console.log('Stores initialized');

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

    // Initialize Inventory Items (Specified List of 34 Items)
    const inventoryItems = [
        // 1-8
        { code: "OSPFTA003", name: "Fiber Drop Wire", commonName: "Drop Wire", source: "SLT", category: "OSP-FTTH", unit: "km", isOspFtth: true },
        { code: "OSP-HC-CBL-DW", name: "Single Mode 1 Core,Fiber optic Drop cable", commonName: "Drop Wire", source: "COMPANY", category: "OSP-FTTH", unit: "m", isOspFtth: true },
        { code: "OSPFTA005", name: "Fiber Drop Wire Retainer(White)", commonName: "DW-RT", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-NC-ACC-DWRETNER", name: "Drop Wire Retainer", commonName: "DW-RT", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-NC-MM-LHOOK", name: "L Hook", commonName: "Hook L", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPACC017", name: "Hook \"L\"", commonName: "Hook L", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-NC-MM-NUT&B-1/2 x 61/2", name: "Bolts & Nuts - 1/2 x 6 1/2", commonName: "Bolt & Nuts", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPACC011", name: "Bolt & Nut -L117(6 1/2\" x 1/2\")", commonName: "Bolt & Nuts", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },

        // 9-16
        { code: "OSP-NC-MM-CHOOK", name: "C Hook", commonName: "Hook C", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPACC018", name: "Hook \"C\"", commonName: "Hook C", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPFTA007", name: "Fibre Rosette Box", commonName: "Rosette", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-HC-ACC-FAC", name: "FAC Connector -E-6", commonName: "FAC Connector", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPFTA002", name: "FAC Connector", commonName: "FAC Connector", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPWIR011", name: "PVC Twin Cable /(0.65 mm)", commonName: "IN-W", source: "SLT", category: "OSP-FTTH", unit: "m", isOspFtth: true },
        { code: "OSP-CC-CAB-INTNALTC-1X0.65MM", name: "Telephone Cable -1x0.65 mm-1Pair", commonName: "IN-W", source: "COMPANY", category: "OSP-FTTH", unit: "m", isOspFtth: true },
        { code: "HDB-HDW-ROSET-1", name: "Single Rossette", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },

        // 17-24
        { code: "CAB-UTP-PRO-CBOX-C5E", name: "Cat5e UTP Cable Box -305m", commonName: "CAT 5E", source: "COMPANY", category: "OSP-FTTH", unit: "m", isOspFtth: true },
        { code: "ITEACC046", name: "UTP Cable CAT 5E", commonName: "CAT 5E", source: "SLT", category: "OSP-FTTH", unit: "m", isOspFtth: true },
        { code: "NWE-ACC-RJ45", name: "RJ 45 Connectors- Hi Quality", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "HDB-HDW-CTIE-4", name: "Cable Tie -4", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Pkt", isOspFtth: true },
        { code: "HDB-CON-PIPE-1/2", name: "Electrical Conduit Pipe -1/2", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "HDB-HDW-ECON-CLIP-1/2", name: "1/2 CONDUIT PIPE CLIP- 5/8", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "HDB-HDW-CNAIL-1", name: "Concrete Nail - 1", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Box", isOspFtth: true },
        { code: "HDB-FLEX-CON-1/4-W", name: "Flexible Conduit (White Color) -1/4\"", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "m", isOspFtth: true },

        // 25-34
        { code: "NWE-ACC-RJ11", name: "RJ 11 Connectors", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-ACC-UCLIP-4M", name: "U Clip Box - 4mm", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Box", isOspFtth: true },
        { code: "HDB-TRUNK-16x12.5", name: "PVC Trunking - 16x12.5mm", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "HDB-HDW-SNAIL-1X8", name: "Screw Nail - 1x8", commonName: null, source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-POLE-5.6LL", name: "Concreat Pole - 5.6M (Low Cost Pole)", commonName: "Pole 5.6m", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPCPL008", name: "Concrete Pole Low Cost - L18(18ft/5.6m)", commonName: "Pole 5.6m", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-POLE-6.7LL", name: "Concreat Pole - 6.7M (Low Cost Pole)", commonName: "Pole 6.7m", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPCPL009", name: "Concrete Pole Square - L22(22ft/6.7m)", commonName: "Pole 6.7m", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSP-POLE-8MH", name: "Concreat Pole Heavy - 8M", commonName: "Pole 8.0m", source: "COMPANY", category: "OSP-FTTH", unit: "Nos", isOspFtth: true },
        { code: "OSPCPL004", name: "Concrete Pole - L26 (26ft/8.0m)", commonName: "Pole 8.0m", source: "SLT", category: "OSP-FTTH", unit: "Nos", isOspFtth: true }
    ];

    console.log('Seeding Inventory Items...');

    const { randomUUID } = require('crypto');
    for (const item of inventoryItems) {
        const id = randomUUID();
        const now = new Date();
        const commonName = item.commonName || null;
        const isOspFtth = item.isOspFtth || false;
        const itemType = item.type || 'SLTS';
        const isWastageAllowed = item.isWastageAllowed ?? true;

        await prisma.$executeRaw`
            INSERT INTO "InventoryItem" ("id", "code", "name", "category", "unit", "type", "commonName", "isOspFtth", "isWastageAllowed", "updatedAt", "createdAt", "source", "minLevel")
            VALUES (${id}, ${item.code}, ${item.name}, ${item.category}, ${item.unit}, ${itemType}, ${commonName}, ${isOspFtth}, ${isWastageAllowed}, ${now}, ${now}, 'SLT', 0)
            ON CONFLICT ("code") DO UPDATE SET
                "name" = ${item.name},
                "category" = ${item.category},
                "unit" = ${item.unit},
                "type" = ${itemType},
                "commonName" = ${commonName},
                "isOspFtth" = ${isOspFtth},
                "isWastageAllowed" = ${isWastageAllowed},
                "updatedAt" = ${now};
        `;
    }

    console.log(`Inventory Items initialized: ${inventoryItems.length} items processed.`);

    // Seed OSP_ITEM_ORDER
    const orderedCodes = [
        "OSPFTA003", "OSP-HC-CBL-DW", "OSPFTA002", "OSP-HC-ACC-FAC", "OSPFTA007",
        "OSPACC018", "OSP-NC-MM-CHOOK", "OSPACC017", "OSP-NC-MM-LHOOK", "OSPACC011",
        "OSP-NC-MM-NUT&B-1/2 x 61/2", "OSPFTA005", "OSP-NC-ACC-DWRETNER", "OSPWIR011",
        "OSP-CC-CAB-INTNALTC-1X0.65MM", "OSPCPL008", "OSP-POLE-5.6LL", "OSPCPL009",
        "OSP-POLE-6.7LL", "OSPCPL004", "OSP-POLE-8MH", "CAB-UTP-PRO-CBOX-C5E",
        "ITEACC046", "HDB-CON-PIPE-1/2", "HDB-FLEX-CON-1/4-W", "HDB-HDW-CTIE-4",
        "HDB-HDW-CNAIL-1", "HDB-HDW-SNAIL-1", "NWE-ACC-RJ11", "NWE-ACC-RJ45",
        "HDB-HDW-ROSET-1"
    ];

    const dbItems = await prisma.inventoryItem.findMany({
        where: { code: { in: orderedCodes } },
        select: { id: true, code: true }
    });

    const idMap = {};
    dbItems.forEach(item => idMap[item.code] = item.id);

    const orderedIds = orderedCodes.map(code => idMap[code]).filter(Boolean);

    console.log('OSP_ITEM_ORDER seeded successfully.');

    // --- Bank and Branch Seeding ---
    console.log('Seeding Banks and Branches...');
    const banksList = [
        { code: "7852", name: "Alliance Finance Company PLC" }, { code: "7463", name: "Amana Bank PLC" },
        { code: "7472", name: "Axis Bank" }, { code: "7010", name: "Bank of Ceylon" },
        { code: "7481", name: "Cargills Bank Limited" }, { code: "8004", name: "Central Bank of Sri Lanka" },
        { code: "7825", name: "Central Finance PLC" }, { code: "7047", name: "Citi Bank" },
        { code: "7746", name: "Citizen Development Business Finance PLC" }, { code: "7056", name: "Commercial Bank PLC" },
        { code: "7870", name: "Commercial Credit & Finance PLC" }, { code: "7807", name: "Commercial Leasing and Finance" },
        { code: "7205", name: "Deutsche Bank" }, { code: "7454", name: "DFCC Bank PLC" },
        { code: "7074", name: "Habib Bank Ltd" }, { code: "7083", name: "Hatton National Bank PLC" },
        { code: "7737", name: "HDFC Bank" }, { code: "7092", name: "Hongkong Shanghai Bank" },
        { code: "7384", name: "ICICI Bank Ltd" }, { code: "7108", name: "Indian Bank" },
        { code: "7117", name: "Indian Overseas Bank" }, { code: "7834", name: "Kanrich Finance Limited" },
        { code: "7861", name: "Lanka Orix Finance PLC" }, { code: "7773", name: "LB Finance PLC" },
        { code: "7269", name: "MCB Bank Ltd" }, { code: "7913", name: "Mercantile Investment and Finance PLC" },
        { code: "7898", name: "Merchant Bank of Sri Lanka & Finance PLC" }, { code: "7214", name: "National Development Bank PLC" },
        { code: "7719", name: "National Savings Bank" }, { code: "7162", name: "Nations Trust Bank PLC" },
        { code: "7311", name: "Pan Asia Banking Corporation PLC" }, { code: "7135", name: "Peoples Bank" },
        { code: "7922", name: "People’s Leasing & Finance PLC" }, { code: "7296", name: "Public Bank" },
        { code: "7755", name: "Regional Development Bank" }, { code: "7278", name: "Sampath Bank PLC" },
        { code: "7728", name: "Sanasa Development Bank" }, { code: "7782", name: "Senkadagala Finance PLC" },
        { code: "7287", name: "Seylan Bank PLC" }, { code: "7038", name: "Standard Chartered Bank" },
        { code: "7144", name: "State Bank of India" }, { code: "7764", name: "State Mortgage & Investment Bank" },
        { code: "7302", name: "Union Bank of Colombo PLC" }, { code: "7816", name: "Vallibel Finance PLC" }
    ];

    for (const b of banksList) {
        const bank = await prisma.bank.upsert({
            where: { code: b.code },
            update: { name: b.name },
            create: { code: b.code, name: b.name },
        });

        if (b.code === "7010") {
            const { bocBranches } = require('./data/boc_branches');
            console.log(`Seeding ${bocBranches.length} branches for BOC...`);
            for (const branch of bocBranches) {
                await prisma.bankBranch.upsert({
                    where: { bankId_code: { bankId: bank.id, code: branch.code } },
                    update: { name: branch.name },
                    create: { bankId: bank.id, code: branch.code, name: branch.name },
                });
            }
        }
    }
    console.log('Banks and Branches seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
