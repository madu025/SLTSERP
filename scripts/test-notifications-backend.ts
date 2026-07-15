import { prisma } from '../src/lib/prisma';
import { NotificationService } from '../src/services/notification/index';

async function main() {
    console.log('------------------------------------------------------------');
    console.log('[TEST] Starting Notification RTOM-Specific Auto-Clear Test...');
    console.log('------------------------------------------------------------');

    // 1. Fetch or create a test User
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log('[TEST] Creating temporary test user...');
        user = await prisma.user.create({
            data: {
                username: 'testuser',
                email: 'testuser@slts.lk',
                password: 'hashedpassword123',
                name: 'Test Notification User',
                role: 'ENGINEER',
            }
        });
    }
    const userId = user.id;
    console.log(`[TEST] Using User ID: ${userId} (${user.username})`);

    // 2. Fetch or create test OPMC models (RTOM 'AD' and 'GM')
    let opmcAD = await prisma.oPMC.findUnique({ where: { rtom: 'AD' } });
    if (!opmcAD) {
        console.log('[TEST] Creating temporary OPMC for AD...');
        opmcAD = await prisma.oPMC.create({
            data: {
                name: 'Anuradhapura OPMC',
                rtom: 'AD',
                region: 'NORTH',
                province: 'NORTH_CENTRAL'
            }
        });
    }

    let opmcGM = await prisma.oPMC.findUnique({ where: { rtom: 'GM' } });
    if (!opmcGM) {
        console.log('[TEST] Creating temporary OPMC for GM...');
        opmcGM = await prisma.oPMC.create({
            data: {
                name: 'Gampaha OPMC',
                rtom: 'GM',
                region: 'WESTERN_OUTER',
                province: 'WESTERN'
            }
        });
    }

    console.log(`[TEST] OPMC AD ID: ${opmcAD.id}, OPMC GM ID: ${opmcGM.id}`);

    // 3. Clear existing notifications for test user to have a clean slate
    await prisma.notification.deleteMany({ where: { userId } });
    console.log('[TEST] Cleared existing notifications for test user.');

    // 4. Create 3 notifications for AD OPMC and 2 notifications for GM OPMC
    console.log('[TEST] Creating notifications...');
    await prisma.notification.createMany({
        data: [
            {
                userId,
                title: 'New SOD in AD 1',
                message: 'Service Order assigned in AD OPMC',
                type: 'PROJECT',
                link: '/service-orders',
                isRead: false,
                metadata: { opmcId: opmcAD.id }
            },
            {
                userId,
                title: 'New SOD in AD 2',
                message: 'Service Order assigned in AD OPMC',
                type: 'PROJECT',
                link: '/service-orders',
                isRead: false,
                metadata: { opmcId: opmcAD.id }
            },
            {
                userId,
                title: 'New SOD in AD 3',
                message: 'Service Order assigned in AD OPMC',
                type: 'PROJECT',
                link: '/service-orders',
                isRead: false,
                metadata: { opmcId: opmcAD.id }
            },
            {
                userId,
                title: 'New SOD in GM 1',
                message: 'Service Order assigned in GM OPMC',
                type: 'PROJECT',
                link: '/service-orders',
                isRead: false,
                metadata: { opmcId: opmcGM.id }
            },
            {
                userId,
                title: 'New SOD in GM 2',
                message: 'Service Order assigned in GM OPMC',
                type: 'PROJECT',
                link: '/service-orders',
                isRead: false,
                metadata: { opmcId: opmcGM.id }
            }
        ]
    });

    // Verify initial counts
    let totalUnread = await prisma.notification.count({ where: { userId, isRead: false } });
    console.log(`[TEST] Initial Total Unread Notifications: ${totalUnread} (Expected: 5)`);
    if (totalUnread !== 5) throw new Error('Initial count mismatch');

    // 5. Simulate viewing AD RTOM -> Trigger markLinkAsRead with opmcId of AD
    console.log('[TEST] Emulating user viewing AD RTOM (opmcId: ' + opmcAD.id + ')...');
    await NotificationService.markLinkAsRead(userId, '/service-orders', opmcAD.id);

    // Verify counts after reading AD
    let afterADUnread = await prisma.notification.count({ where: { userId, isRead: false } });
    let unreadAD = await prisma.notification.count({ 
        where: { 
            userId, 
            isRead: false, 
            metadata: { path: ['opmcId'], equals: opmcAD.id } 
        } 
    });
    let unreadGM = await prisma.notification.count({ 
        where: { 
            userId, 
            isRead: false, 
            metadata: { path: ['opmcId'], equals: opmcGM.id } 
        } 
    });

    console.log(`[TEST] Unread notifications count after viewing AD:`);
    console.log(`       - Total Unread: ${afterADUnread} (Expected: 2)`);
    console.log(`       - AD Unread: ${unreadAD} (Expected: 0)`);
    console.log(`       - GM Unread: ${unreadGM} (Expected: 2)`);

    if (afterADUnread !== 2 || unreadAD !== 0 || unreadGM !== 2) {
        throw new Error('Test Failed: Counts after viewing AD mismatch');
    }

    // 6. Simulate viewing GM RTOM -> Trigger markLinkAsRead with opmcId of GM
    console.log('[TEST] Emulating user viewing GM RTOM (opmcId: ' + opmcGM.id + ')...');
    await NotificationService.markLinkAsRead(userId, '/service-orders', opmcGM.id);

    // Verify counts after reading GM
    let afterGMUnread = await prisma.notification.count({ where: { userId, isRead: false } });
    console.log(`[TEST] Total Unread Notifications after viewing GM: ${afterGMUnread} (Expected: 0)`);

    if (afterGMUnread !== 0) {
        throw new Error('Test Failed: Counts after viewing GM mismatch');
    }

    console.log('------------------------------------------------------------');
    console.log('[TEST SUCCESS] Notification RTOM-Specific Auto-Clear Test passed!');
    console.log('------------------------------------------------------------');
}

main()
    .catch((err) => {
        console.error('[TEST FAILED]', err);
        process.exit(1);
    });
