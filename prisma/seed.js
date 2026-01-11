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

    // Initialize Inventory Items (Full List)
    const inventoryItems = [
        { code: "CAB-UTP-PRO-CBOX-C5E", name: "Cat5e UTP Cable Box -305m", category: "NETWORK - PASSIVE", unit: "m", commonName: "CAT 5E", isOspFtth: true, type: "SLTS" },
        { code: "HDB-CON-PIPE-1/2", name: "Electrical Conduit Pipe -1/2", category: "HARDWARE & LAYING ITEM", unit: "Nos", isOspFtth: true, type: "SLTS" },
        { code: "HDB-ECON-PIPE-1", name: "Electrical Conduit Pipe -1", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-FLEX-CON-1/4-W", name: "Flexible Conduit (White Color) -1/4'", category: "HARDWARE & LAYING ITEM", unit: "m", isOspFtth: true, type: "SLTS" },
        { code: "HDB-HDW-ACC-TBOLT", name: "Top Bolt", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-CNAIL-1", name: "Concrete Nail - 1", category: "HARDWARE & LAYING ITEM", unit: "Box", isOspFtth: true, type: "SLTS" },
        { code: "HDB-HDW-CNAIL-11/2", name: "Concrete Nail - 11/2", category: "HARDWARE & LAYING ITEM", unit: "Box" },
        { code: "HDB-HDW-CTIE-12", name: "Cable Tie - 12", category: "SAFETY ITEM", unit: "Box" },
        { code: "HDB-HDW-CTIE-4", name: "Cable Tie -4", category: "HARDWARE & LAYING ITEM", unit: "Pkt", isOspFtth: true, type: "SLTS" },
        { code: "HDB-HDW-CTIE-TG-4", name: "Nylon Cable Tie With Tagging Line -4'", category: "OSP-PROJECT", unit: "Pkt" },
        { code: "HDB-HDW-ECON-BEND-1", name: "Electrical Conduit Bend --1", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-ECON-BEND-1/2", name: "Electrical Conduit Bend -1/2", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-ECON-CLIP-1/2", name: "1/2 CONDUIT PIPE  CLIP- 5/8", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-ECON-SKT-1", name: "Electrical Conduit Socket --1", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-FCON-1", name: "Flexible Conduit -1", category: "HARDWARE & LAYING ITEM", unit: "m" },
        { code: "HDB-HDW-GI-BEND-1", name: "GI U Bend -1'", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-GI-PIPE-3/4", name: "GI Pipe -3/4' ' Thikness1.8mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "HDB-HDW-ITAPE", name: "PVC Insulation Tape", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-PU-FOAM", name: "PU Foam Spray 750ml", category: "OTHER ITEMS", unit: "Bot" },
        { code: "HDB-HDW-ROSET-1", name: "Single Rossette", category: "HARDWARE & LAYING ITEM", unit: "Nos", isOspFtth: true, type: "SLTS" },
        { code: "HDB-HDW-SCON", name: "Silicone Sealant (Tube)", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-HDW-SNAIL-1", name: "Screw Nail - 1x8", category: "HARDWARE & LAYING ITEM", unit: "Box", isOspFtth: true, type: "SLTS" },
        { code: "HDB-HDW-SNAIL-1.5", name: "Screw Nail -1 1/2' x8'", category: "HARDWARE & LAYING ITEM", unit: "Box" },
        { code: "HDB-HDW-SNAIL-1X8", name: "Screw Nail - 1", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-NDW-RPLUG-S6", name: "Roll Plug - S6", category: "HARDWARE & LAYING ITEM", unit: "Bot" },
        { code: "HDB-NDW-RPLUG-S6-1", name: "Roll Plug - S6", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-PVC-BEND-90M-3", name: "Water Pipe BEND -3-90MM", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-PVC-PIPE-110M-1000T", name: "Water Pipe-110MM-4'-1000TY", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-PVC-PIPE-90M-1000T", name: "Water Pipe-90MM-3-1000TY", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-PVC-RSKT- 32X25", name: "REDUCING SOCKET 32 X25 mm", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "HDB-TRUNK-16x12.5", name: "PVC Trunking - 16x12.5mm", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "NWE-ACC-RJ11", name: "RJ 11 Connectors", category: "NETWORK - PASSIVE", unit: "Nos", isOspFtth: true, type: "SLTS" },
        { code: "NWE-ACC-RJ45", name: "RJ 45 Connectors- Hi Quality", category: "NETWORK - PASSIVE", unit: "Nos", isOspFtth: true, type: "SLTS" },
        { code: "OFC-ACC-PTAIL-3M-SMSX", name: "Fibre Pigtail with FC/UPC SX-SM (0.9) 3M", category: "FIBER CABLE & ACCESSORIES ", unit: "Nos" },
        { code: "OFC-ACC-PTAIL-3OPP-SM1M", name: "Fiber Pigtail -(SM-Single Mode) -1mtrs", category: "FIBER CABLE & ACCESSORIES ", unit: "Nos" },
        { code: "OFC-FPC-FCFC-SM2M", name: "Fiber Patch Cord-FC-FC (Single Mode)-2mtrs", category: "FIBER CABLE & ACCESSORIES ", unit: "Nos" },
        { code: "OFC-FPC-SCSC-SM2M", name: "Fiber Patch Cord SM-Single Mode-2m (SC-SC)", category: "NETWORK - PASSIVE", unit: "Nos" },
        { code: "OSP-ACC-UCLIP-4M", name: "U Clip Box - 4mm", category: "HARDWARE & LAYING ITEM", unit: "Box" },
        { code: "OSP-CC-ACC-DWCONNTER", name: "Drop Wire Connectors 557TG", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-CC-CAB-INTNALTC-1X0.65MM", name: "Telephone Cable -1x0.65 mm-1Pair", category: "HARDWARE & LAYING ITEM", unit: "m", commonName: "IN-W", isOspFtth: true, type: "SLTS" },
        { code: "OSP-CC-CBL-DW-2/0.65", name: "2/0.65 Drop Wire  (Roll 1= 500 Mtrs.)", category: "OSP-PSTN", unit: "m" },
        { code: "OSP-CC-MM-TSP", name: "Telephone Station Protector", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-HC-ACC-FAC", name: "FAC Connector -E-6", category: "OSP-FTTH", unit: "Nos", commonName: "FAC Connector", isOspFtth: true, type: "SLTS" },
        { code: "OSP-HC-ACC-FWS", name: "FWS Wall Socket-E-1 (fiber Wall Socket with SC/UPC", category: "OSP-FTTH", unit: "Nos" },
        { code: "OSP-HC-CBL-DW", name: "Single Mode 1 Core,Fiber optic Drop cable", category: "OSP-FTTH", unit: "m", commonName: "Drop Wire", isOspFtth: true, type: "SLTS" },
        { code: "OSP-HC-CBL-DW-2C", name: "Single Mode 2Core,Fiber Optic Drop cable-(Non Protective)", category: "OSP-PROJECT", unit: "m" },
        { code: "OSP-HC-CBL-DW-PASTEBLE", name: "Single Mode pasteble Self Adhesive Fiber Drop Cabl", category: "OSP-PROJECT", unit: "m" },
        { code: "OSP-HDB-HDW-RB-1/4x11/2", name: "Roofing Bolt. Washer & Nut -1/4' x 1 1/2'", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-NC-ACC-DWCLEAT", name: "Drop Wire Cleat", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-NC-ACC-DWGRIP", name: "Drop Wire Gripper", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-NC-ACC-DWRETNER", name: "Drop Wire Retainer", category: "OSP-PSTN", unit: "Nos", commonName: "DW-RT", isOspFtth: true, type: "SLTS" },
        { code: 'MAT001', name: 'Fiber Cable 24C', category: 'CABLE', unit: 'm', commonFor: ['SLT'] },
        { code: 'MAT002', name: 'Fiber Cable 48C', category: 'CABLE', unit: 'm', commonFor: ['SLT'] },
        { code: 'MAT003', name: 'Closure 24C', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'] },
        { code: 'MAT004', name: 'Splitter 1:8', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'] },
        // ... Existing items can remain or be replaced. I will append the NEW specific list here ...
        // User Provided OSP List
        { code: 'OSPFTA002', name: 'FAC Connector', category: 'CONNECTOR', unit: 'Nos', commonFor: ['SLT'], commonName: "FAC Connector", isOspFtth: true, type: 'SLT' },
        { code: 'OSPFTA007', name: 'Fibre Rosette Box', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'], commonName: "Rosette", type: 'SLT', isOspFtth: true },
        { code: 'OSPACC018', name: 'Hook "C"', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'], commonName: "Hook C", isOspFtth: true, type: 'SLT' },
        { code: 'OSPACC017', name: 'Hook "L"', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'], commonName: "Hook L", isOspFtth: true, type: 'SLT' },
        { code: 'OSPACC011', name: 'Bolt & Nut -L117(6 1/2" x 1/2")', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'], commonName: "Bolt & Nuts", type: 'SLT', isOspFtth: true },
        { code: 'OSPFTA005', name: 'Fiber Drop Wire Retainer(White)', category: 'ACCESSORY', unit: 'Nos', commonFor: ['SLT'], commonName: "DW-RT", type: 'SLT', isOspFtth: true },
        { code: 'OSPFTA003', name: 'Fiber Drop Wire', category: 'CABLE', unit: 'km', commonFor: ['SLT'], commonName: "Drop Wire", isOspFtth: true, type: 'SLT' },
        { code: 'OSPWIR011', name: 'PVC Twin Cable /(0.65 mm)', category: 'CABLE', unit: 'm', commonFor: ['SLT'], commonName: "IN-W", type: 'SLT', isOspFtth: true },
        { code: 'OSPCPL008', name: 'Concrete Pole Low Cost - L18(18ft/5.6m)', category: 'POLE', unit: 'Nos', commonFor: ['SLT'], commonName: "Pole 5.6m", isOspFtth: true, type: 'SLT' },
        { code: 'OSPCPL009', name: 'Concrete Pole Square - L22(22ft/6.7m)', category: 'POLE', unit: 'Nos', commonFor: ['SLT'], commonName: "Pole 6.7m", isOspFtth: true, type: 'SLT' },
        { code: 'OSPCPL004', name: 'Concrete Pole - L26 (26ft/8.0m)', category: 'POLE', unit: 'Nos', commonFor: ['SLT'], commonName: "Pole 8.0m", isOspFtth: true, type: 'SLT' },
        { code: 'ITEACC046', name: 'UTP Cable CAT 5E', category: 'CABLE', unit: 'm', commonFor: ['SLT'], commonName: "CAT 5E", isOspFtth: true, type: 'SLT' },
        { code: "OSP-NC-MM-CHOOK", name: "C Hook", category: "OSP-PSTN", unit: "Nos", commonName: "Hook C", isOspFtth: true, type: "SLTS" },
        { code: "OSP-NC-MM-LHOOK", name: "L Hook", category: "OSP-PSTN", unit: "Nos", commonName: "Hook L", isOspFtth: true, type: "SLTS" },
        { code: "OSP-NC-MM-NUT&B-1/2 x 61/2", name: "Bolts & Nuts - 1/2 x 61/2", category: "OSP-PSTN", unit: "Nos", commonName: "Bolt & Nuts", isOspFtth: true, type: "SLTS" },
        { code: "OSP-POLE-5.6LL", name: "Concreat Pole - 5.6M (Low Cost Pole)", category: "OSP-FTTH", unit: "Nos", commonName: "Pole 5.6m", isOspFtth: true, type: "SLTS" },
        { code: "OSP-POLE-6.7H", name: "Concreat Pole - 6.7M (Heavy Pole)", category: "OSP-PSTN", unit: "Nos" },
        { code: "OSP-POLE-6.7LL", name: "Concreat Pole - 6.7M (Low Cost Pole)", category: "OSP-FTTH", unit: "Nos", commonName: "Pole 6.7m", isOspFtth: true, type: "SLTS" },
        { code: "OSP-POLE-8MH", name: "Concreat Pole Heavy - 8M", category: "OSP-FTTH", unit: "Nos", commonName: "Pole 8.0m", isOspFtth: true, type: "SLTS" },
        { code: "OSP-PRO-ACC-AERIAL-2x12", name: "Aerial Closure - 2 x 12", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-AERIAL-2x19", name: "Aerial Closure - 2 x 19", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-BAND-10MM", name: "S.S Band- 10mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-BAND-20MM", name: "S.S. Band - 20mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-BUCKLE-10MM", name: "S.S Buckle-10mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-CCLIP", name: "Cokadile Clip -(Cable Earth) -RED & WHITE (BOTH)", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-CGRIP-14MM", name: "Cable Grip -14mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-CGRIP-18MM", name: "Cable Grip 18mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-DPRNG", name: "D.P. Ring", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-DUCT-S", name: "4416 DUCT SEALING KIT", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-F-PTAIL-SX-SM1.5M", name: "O/F Pigtail FC/UPC,SM,SX (0.9mm)-1.5m", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-F-SPLIT-1X8-SC", name: "1:8 Splitter PLC Micro Sc Connector", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-JHOOK", name: "J HOOK", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-A-CLMP", name: "Angle Clamp", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-BRET", name: "Pole Bracket - Square type", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-BRET-RND", name: "Pole Bracket - Round  Type", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-GUYSET", name: "Stay Rod /GUY Set - Complete", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-S-CLMP", name: "Straight Clamp", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-STAY-BR", name: "Stay Bracket (Guy Band)", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-STRUT-BR", name: "Strut Bracket", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PLA-TBR/2R", name: "Termination Bracket - 2R", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-PVC-SPACER-B", name: "PVC Spacer B", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-SPIRAL", name: "Arial Spiral", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-SUPER-MC", name: "Super Mini Connector", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-TCONNET-UB2A", name: "T-CONNECTORS-UB2A", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-TIGHT-10MM", name: "S.S Tightners-10mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC122/30-300", name: "122/30 X 300 CC Closser", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC122/30-500", name: "122/30 -500 Closure", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC122/30-650", name: "122/30-650 UG CLOSER", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC160//42-720", name: "160/42 X 720 CC Closser", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC160/42-500", name: "160/42-500 UG CLOSER", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC43/8-200", name: "43/8 -200 Closure", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC43/8-350", name: "43/8-350 Closure", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC75/15-250", name: "75/15 -250 Closure", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC75/15-500", name: "75/15-500UG Closure", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UGC92/25-500", name: "92/25-500 CLOSER", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-ACC-UY2", name: "Butt Connectors-UY2", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-CAB-BEARC-50MM", name: "Bear Copper-50mm2", category: "OSP-PROJECT", unit: "m" },
        { code: "OSP-PRO-CBL-ARP-6MM", name: "Armarnd Cable-6mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FDP", name: "FDP+Splitter", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FDP-WM-ID-J3", name: "FDP/Small [ID/Wall,Rack Mounted / 4X1:4,2X1:8 Spli", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FTC-2OP-ID", name: "FTC/Small [ID/Pole,Wall Mounted -20Port Indoor Type", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FTC-2OP-OD", name: "FTC/Small [OD/Pole,Wall Mounted / 4X1:42X1:8 Spli", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FTC-30P-PM-IOD", name: "30 Port Pole Mounted FTC Outdoor", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-F-FTC-90P-PM-OD", name: "90  ports  pole  mounted FTC-OUTDOOR", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-LUG-25MM", name: "Cable Lug-25mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-LUG-50MM", name: "Cable Lug-50mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-BEND-110/30", name: "PVC Bend 110 mm /30", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-BEND-110/35", name: "PVC BEND -110M/3.5", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-BEND-110/90", name: "PVC Bend-110mm x 90", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-BEND-56/90", name: "PVC Bend-56mm x 90", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-ECAP-110MM", name: "PVC End Cap 110 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-FMOUTH-110MM", name: "PVC Flared Mouth 110mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-FMOUTH-56MM", name: "PVC Flared Mouth 56 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-GICOUP-110MM", name: "PVC GI Coupler 110 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-PIPE-56MM", name: "PVC Telecom Pipes 56 mm -6.1m", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-SOCKET-110MM-D", name: "PVC Double Socket 110 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-SOCKET-110MM-R", name: "PVC Repair Socket 110 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PRO-PVC-SOCKET-56MM-D", name: "PVC Double Socket 56 mm", category: "OSP-PROJECT", unit: "Nos" },
        { code: "OSP-PVC-SKT-90MM", name: "PVC Double Socket -90mm", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "OSP-PVC-UBEND-32M", name: "PVC \"U\" Bend -1' -32MM", category: "HARDWARE & LAYING ITEM", unit: "Nos" },
        { code: "PWR-CAB-50MM", name: "Power Cable -50mm", category: "POWER CABLE & ACCESSORIES ", unit: "m" },
        { code: "PWR-EARTH-KEL-7/0.67", name: "Earth Cable-7/0.67 Cu/PVC", category: "POWER CABLE & ACCESSORIES ", unit: "m" },
        { code: "TOOL-PRIM-FTTH-FTK", name: "FTTH Fibre Tool Kit (With:Fiber Splicing Tools w/ Fiber Cleaver Power Meter VFL)", category: "TOOL", unit: "Nos" },
        { code: "UFM-FTW-SAFE-KDM", name: "\"Kadam\" Rubber Loafers Shoes", category: "SAFETY ITEM", unit: "Nos" },
        { code: "UFM-FTW-SAFE-RCOAT", name: "\"Rubber Coated\" (Heavy Duty Comfortable PVC-Coated Protective Rain Coat)", category: "SAFETY ITEM", unit: "Nos" }
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
