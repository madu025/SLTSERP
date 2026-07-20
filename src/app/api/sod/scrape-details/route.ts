import { SODDetailsScraper } from '@/services/sod-scraper.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sod/scrape-details?soNum=CEN202512230062322
 * Fetch and parse SOD details from SLT HTML page
 */
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const soNum = searchParams.get('soNum');
    const debug = searchParams.get('debug') === 'true';

    if (!soNum) {
        throw AppError.badRequest('soNum parameter is required');
    }

    // Debug mode: Save HTML for analysis
    if (debug) {
        await SODDetailsScraper.saveHTMLForAnalysis(soNum);
        return {
            message: `HTML saved to temp_sod_${soNum}.html for analysis`
        };
    }

    // Fetch and parse SOD details
    const details = await SODDetailsScraper.fetchSODDetails(soNum);

    if (!details) {
        throw AppError.notFound('Failed to fetch SOD details');
    }

    return details;
}, { rawResponse: true });
