import { apiHandler } from '@/lib/api-handler';
import { AdminSystemService } from '@/services/admin/system.service';

export const GET = apiHandler(async () => {
    const status = await AdminSystemService.getSyncStats();
    return Response.json(status);
}, {
    // Accessible without specific roles currently, or add roles if necessary
});
