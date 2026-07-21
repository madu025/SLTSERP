import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';

export const GET = apiHandler(async (req) => {
    const userId = req.headers.get('x-user-id');
    
    console.log(`[TEST] Creating test notification requested by user: ${userId || 'UNKNOWN'}`);
    
    const notification = await NotificationService.sendTestNotification(userId);

    return Response.json({ 
        success: true, 
        message: 'Test notification sent successfully!',
        notification 
    });
});
