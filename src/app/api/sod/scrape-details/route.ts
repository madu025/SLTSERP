import { NextRequest, NextResponse } from 'next/server';
import { SODDetailsScraper } from '@/services/sod-scraper.service';

/**
 * GET /api/sod/scrape-details?soNum=CEN202512230062322
 * Fetch and parse SOD details from SLT HTML page
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const soNum = searchParams.get('soNum');
        const debug = searchParams.get('debug') === 'true';

        if (!soNum) {
            return NextResponse.json(
                { error: 'soNum parameter is required' },
                { status: 400 }
            );
        }

        // Debug mode: Save HTML for analysis
        if (debug) {
            await SODDetailsScraper.saveHTMLForAnalysis(soNum);
            return NextResponse.json({
                message: `HTML saved to temp_sod_${soNum}.html for analysis`
            });
        }

        // Fetch and parse SOD details
        const details = await SODDetailsScraper.fetchSODDetails(soNum);

        if (!details) {
            return NextResponse.json(
                { error: 'Failed to fetch SOD details' },
                { status: 404 }
            );
        }

        return NextResponse.json(details);

    } catch (error) {
        console.error('Failed to scrape SOD details:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
