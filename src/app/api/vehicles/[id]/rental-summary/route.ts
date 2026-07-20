import { rentalPaymentService } from '@/services/RentalPaymentService';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

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
 */
export const GET = apiHandler(async (request, params) => {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;

  const rentalVehicle = await rentalPaymentService.getRentalVehicleByVehicleId(id);

  if (!rentalVehicle) {
    throw AppError.notFound('Rental vehicle not found for this vehicle');
  }

  // Mode: preview - calculate without saving
  if (mode === 'preview' && year && month) {
    const preview = await rentalPaymentService.previewSummary({
      rentalVehicleId: rentalVehicle.id,
      year,
      month,
    });
    return { success: true, data: preview };
  }

  // Fetch specific summary if year/month provided
  if (year && month) {
    const summary = await rentalPaymentService.getSummary(rentalVehicle.id, year, month);
    if (!summary) {
      throw AppError.notFound('No summary found for this period');
    }
    return { success: true, data: summary };
  }

  // List all summaries
  const summaries = await rentalPaymentService.listSummaries(rentalVehicle.id);

  return {
    success: true,
    data: summaries,
    meta: { 
      rentalVehicleId: rentalVehicle.id, 
      total: summaries.length,
      rentalVehicle
    },
  };
}, { rawResponse: true });

/**
 * POST /api/vehicles/[id]/rental-summary
 */
export const POST = apiHandler(async (request, params, body: RequestBody) => {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const { action, year, month, userId, userName, remarks } = body;

  if (action === 'save-agreement') {
    const result = await rentalPaymentService.upsertRentalVehicle(id, body);
    return { success: true, data: result };
  }

  const rentalVehicle = await rentalPaymentService.getRentalVehicleByVehicleId(id);

  if (!rentalVehicle) {
    throw AppError.notFound('Rental vehicle not found for this vehicle');
  }

  const rentalVehicleId = rentalVehicle.id;

  switch (action) {
    case 'create': {
      if (!year || !month) {
        throw AppError.badRequest('year and month are required');
      }

      const summary = await rentalPaymentService.saveSummary(
        { rentalVehicleId, year, month },
        userId ? { id: userId, name: userName || userId } : undefined
      );

      return { success: true, data: summary };
    }

    case 'submit': {
      if (!body.summaryId) {
        throw AppError.badRequest('summaryId is required');
      }
      const result = await rentalPaymentService.submitSummary(
        body.summaryId,
        userId ? { id: userId, name: userName || userId } : undefined
      );
      return { success: true, data: result };
    }

    case 'check': {
      if (!body.summaryId) {
        throw AppError.badRequest('summaryId is required');
      }
      if (!userId) {
        throw AppError.badRequest('userId is required for check action');
      }
      const result = await rentalPaymentService.checkSummary(
        body.summaryId,
        { id: userId, name: userName || userId },
        remarks
      );
      return { success: true, data: result };
    }

    case 'recommend': {
      if (!body.summaryId || !userId) {
        throw AppError.badRequest('summaryId and userId are required');
      }
      const result = await rentalPaymentService.recommendSummary(
        body.summaryId,
        { id: userId, name: userName || userId },
        remarks
      );
      return { success: true, data: result };
    }

    case 'approve': {
      if (!body.summaryId || !userId) {
        throw AppError.badRequest('summaryId and userId are required');
      }
      const result = await rentalPaymentService.approveSummary(
        body.summaryId,
        { id: userId, name: userName || userId },
        remarks
      );
      return { success: true, data: result };
    }

    case 'reject': {
      if (!body.summaryId || !userId || !remarks) {
        throw AppError.badRequest('summaryId, userId, and remarks are required for rejection');
      }
      const result = await rentalPaymentService.rejectSummary(
        body.summaryId,
        { id: userId, name: userName || userId },
        remarks
      );
      return { success: true, data: result };
    }

    default:
      throw AppError.badRequest(`Unknown action: ${action}`);
  }
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN'],
  audit: { action: 'POST_ACTION', entity: 'RENTAL_SUMMARY' },
  rawResponse: true
});

/**
 * DELETE /api/vehicles/[id]/rental-summary?summaryId=xxx
 */
export const DELETE = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const summaryId = searchParams.get('summaryId');

  if (!summaryId) {
    throw AppError.badRequest('summaryId query param is required');
  }

  await rentalPaymentService.deleteSummary(summaryId);

  return { success: true, data: { message: 'Summary deleted successfully' } };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN'],
  audit: { action: 'DELETE', entity: 'RENTAL_SUMMARY' },
  rawResponse: true
});
