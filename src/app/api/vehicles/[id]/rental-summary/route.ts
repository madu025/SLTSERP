import { NextRequest, NextResponse } from 'next/server';
import { rentalPaymentService } from '@/services/RentalPaymentService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  action: 'create' | 'submit' | 'check' | 'recommend' | 'approve' | 'reject' | 'save-agreement';
  year?: number;
  month?: number;
  userId?: string;
  userName?: string;
  remarks?: string;
  summaryId?: string;
}

/**
 * GET /api/vehicles/[id]/rental-summary
 *   Query params: ?mode=preview&year=2026&month=6  -> Preview calculation
 *   Query params: ?year=2026&month=6                 -> Fetch existing summary
 *   No query params                                  -> List all summaries for this vehicle
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;

    const rentalVehicle = await rentalPaymentService.getRentalVehicleByVehicleId(id);

    if (!rentalVehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rental vehicle not found for this vehicle' } },
        { status: 404 }
      );
    }

    // Mode: preview - calculate without saving
    if (mode === 'preview' && year && month) {
      const preview = await rentalPaymentService.previewSummary({
        rentalVehicleId: rentalVehicle.id,
        year,
        month,
      });

      return NextResponse.json({ success: true, data: preview });
    }

    // Fetch specific summary if year/month provided
    if (year && month) {
      const summary = await rentalPaymentService.getSummary(rentalVehicle.id, year, month);

      if (!summary) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'No summary found for this period' } },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: summary });
    }

    // List all summaries
    const summaries = await rentalPaymentService.listSummaries(rentalVehicle.id);

    return NextResponse.json({
      success: true,
      data: summaries,
      meta: { 
        rentalVehicleId: rentalVehicle.id, 
        total: summaries.length,
        rentalVehicle
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vehicles/[id]/rental-summary
 *   Body: { action: "create"|"submit"|"check"|"recommend"|"approve"|"reject", year, month, userId, userName, remarks }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json()) as RequestBody;
    const { action, year, month, userId, userName, remarks } = body;

    const rentalVehicle = await rentalPaymentService.getRentalVehicleByVehicleId(id);

    if (action === 'save-agreement') {
      const result = await rentalPaymentService.upsertRentalVehicle(id, body);
      return NextResponse.json({ success: true, data: result });
    }

    if (!rentalVehicle) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rental vehicle not found for this vehicle' } },
        { status: 404 }
      );
    }

    const rentalVehicleId = rentalVehicle.id;

    switch (action) {
      case 'create': {
        if (!year || !month) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'year and month are required' } },
            { status: 400 }
          );
        }

        const summary = await rentalPaymentService.saveSummary(
          { rentalVehicleId, year, month },
          userId ? { id: userId, name: userName || userId } : undefined
        );

        return NextResponse.json({ success: true, data: summary }, { status: 201 });
      }

      case 'submit': {
        if (!body.summaryId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId is required' } },
            { status: 400 }
          );
        }
        const result = await rentalPaymentService.submitSummary(
          body.summaryId,
          userId ? { id: userId, name: userName || userId } : undefined
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'check': {
        if (!body.summaryId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId is required' } },
            { status: 400 }
          );
        }
        if (!userId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId is required for check action' } },
            { status: 400 }
          );
        }
        const result = await rentalPaymentService.checkSummary(
          body.summaryId,
          { id: userId, name: userName || userId },
          remarks
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'recommend': {
        if (!body.summaryId || !userId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId and userId are required' } },
            { status: 400 }
          );
        }
        const result = await rentalPaymentService.recommendSummary(
          body.summaryId,
          { id: userId, name: userName || userId },
          remarks
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'approve': {
        if (!body.summaryId || !userId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId and userId are required' } },
            { status: 400 }
          );
        }
        const result = await rentalPaymentService.approveSummary(
          body.summaryId,
          { id: userId, name: userName || userId },
          remarks
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'reject': {
        if (!body.summaryId || !userId || !remarks) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId, userId, and remarks are required for rejection' } },
            { status: 400 }
          );
        }
        const result = await rentalPaymentService.rejectSummary(
          body.summaryId,
          { id: userId, name: userName || userId },
          remarks
        );
        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vehicles/[id]/rental-summary?summaryId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const summaryId = searchParams.get('summaryId');

    if (!summaryId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'summaryId query param is required' } },
        { status: 400 }
      );
    }

    await rentalPaymentService.deleteSummary(summaryId);

    return NextResponse.json({ success: true, data: { message: 'Summary deleted successfully' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message } },
      { status: 500 }
    );
  }
}
