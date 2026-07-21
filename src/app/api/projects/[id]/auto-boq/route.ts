import { apiHandler } from '@/lib/api-handler';
import { AutoBOQService } from '@/services/auto-boq.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const cableConfigOverride = body?.cableConfig || {};

    // 1. Generate BOQ from AutoBOQService
    const { boq, summary, cableConfig } = await AutoBOQService.generateBOQ(
        projectId,
        cableConfigOverride
    );

    if (!boq || boq.length === 0) {
        return Response.json(
            {
                success: true,
                message: 'No approved survey points found. BOQ generation produced no items.',
                summary: { TOTAL: 0 },
                itemCount: 0,
            },
            { status: 200 }
        );
    }

    // 2. Save generated BOQ (deletes existing auto-calculated and inserts new ones)
    const createdItems = await AutoBOQService.saveGeneratedBOQ(projectId, boq);

    return Response.json(
        {
            success: true,
            message: `BOQ generated successfully. ${createdItems.length} items created.`,
            summary,
            cableConfig,
            itemCount: createdItems.length,
            items: createdItems,
        },
        { status: 201 }
    );
}, {
    audit: { action: 'GENERATE_AUTO_BOQ', entity: 'PROJECT_BOQ' },
    rawResponse: true
});