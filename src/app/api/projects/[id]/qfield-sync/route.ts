import { apiHandler } from '@/lib/api-handler';
import { QFieldCloudSyncService } from '@/services/qfieldcloud-sync.service';
import { SURVEY_LAYERS } from '@/config/survey-layers';
import { qfieldSyncSchema, QFieldSyncSchema } from '@/lib/validations/gis.schema';

export const dynamic = 'force-dynamic';

/**
 * GET: Get sync history and status
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string }) => {
        const { id: projectId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const syncStatus = await QFieldCloudSyncService.getSyncStatus(projectId);
        return syncStatus;
    }
);

/**
 * POST: Trigger sync operations with QFieldCloud (create project, push layers, or full sync)
 */
export const POST = apiHandler<unknown, QFieldSyncSchema>(
    async (request: Request, params: { id: string }, body) => {
        const { id: projectId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const { action = 'full_sync', qfieldProjectId, qgisTemplate } = body;

        // ── Action: CREATE PROJECT ───────────────────────────────────────────
        if (action === 'create_project') {
            const result = await QFieldCloudSyncService.createQFieldProjectForProject(
                projectId,
                qgisTemplate || undefined
            );
            return result;
        }

        // Validate qfieldProjectId for subsequent actions
        if (!qfieldProjectId) {
            throw new Error('qfieldProjectId is required. Create a QFieldCloud project first.');
        }

        // ── Action: FULL SYNC ────────────────────────────────────────────────
        if (action === 'full_sync') {
            const result = await QFieldCloudSyncService.fullSync(projectId, qfieldProjectId);
            return {
                message: 'Full sync completed',
                result,
                surveyLayers: SURVEY_LAYERS,
            };
        }

        // ── Action: PUSH LAYERS ──────────────────────────────────────────────
        if (action === 'push_layers') {
            const service = new QFieldCloudSyncService();
            await service.pushSurveyLayers(qfieldProjectId);
            return {
                message: 'Survey layers pushed to QFieldCloud',
                layersCount: SURVEY_LAYERS.length,
            };
        }

        throw new Error('Invalid action. Use: create_project, push_layers, full_sync');
    },
    { schema: qfieldSyncSchema }
);