import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
interface CreateOTDRTestInput {
    testNumber?: string;
    testDate?: string;
    testType?: string;
    fiberNumber?: string | number;
    wavelength?: string | number;
    cableSegmentId?: string;
    traceFileName?: string;
    traceFileUrl?: string;
    fileFormat?: string;
    totalLength?: string | number;
    endToEndLoss?: string | number;
    lossPerKm?: string | number;
    orl?: string | number;
    spliceLoss?: string | number;
    connectorLoss?: string | number;
    spliceCount?: string | number;
    eventCount?: string | number;
    lossLimit?: string | number;
    orlLimit?: string | number;
    autoResult?: string;
    failureReason?: string;
    testedById: string;
    equipmentModel?: string;
    equipmentSerial?: string;
    remarks?: string;
    status?: string;
}
export class ProjectOTDRService {
    static async getOTDRTests(projectId: string) {
        return await prisma.oTDRTest.findMany({
            where: { projectId },
            orderBy: { testDate: 'desc' },
        });
    }
    /** A reviewer's decision on a trace. Waiving needs a note; the tester cannot review their own trace. */
    static async reviewOTDRTest(projectId: string, testId: string, reviewerId: string, status: string, notes?: string | null, isAdmin = false) {
        if (!['APPROVED', 'WAIVED', 'REJECTED'].includes(status)) throw AppError.badRequest('INVALID_OTDR_REVIEW_STATUS');
        if (status !== 'APPROVED' && !notes?.trim()) throw AppError.badRequest('OTDR_REVIEW_NOTES_REQUIRED');
        const test = await prisma.oTDRTest.findFirst({ where: { id: testId, projectId }, select: { id: true, testedById: true } });
        if (!test) throw AppError.notFound('OTDR_TEST_NOT_FOUND');
        if (test.testedById === reviewerId && !isAdmin) throw AppError.forbidden('SEGREGATION_OF_DUTIES_VIOLATION: the tester cannot review their own OTDR trace.');
        return prisma.oTDRTest.update({ where: { id: testId }, data: { status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNotes: notes?.trim() || null } });
    }

    static async createOTDRTest(projectId: string, data: CreateOTDRTestInput) {
        const testNumber = data.testNumber || `OTDR-${projectId.slice(0, 8)}-${Date.now()}`;
        return await prisma.oTDRTest.create({
            data: {
                projectId,
                testNumber,
                testDate: data.testDate ? new Date(data.testDate) : new Date(),
                testType: data.testType || 'INSTALLATION_ACCEPTANCE',
                fiberNumber: data.fiberNumber != null ? Number(data.fiberNumber) : null,
                wavelength: data.wavelength != null ? Number(data.wavelength) : null,
                cableSegmentId: data.cableSegmentId ?? null,
                traceFileName: data.traceFileName ?? null,
                traceFileUrl: data.traceFileUrl ?? null,
                fileFormat: data.fileFormat ?? null,
                totalLength: data.totalLength != null ? Number(data.totalLength) : null,
                endToEndLoss: data.endToEndLoss != null ? Number(data.endToEndLoss) : null,
                lossPerKm: data.lossPerKm != null ? Number(data.lossPerKm) : null,
                orl: data.orl != null ? Number(data.orl) : null,
                spliceLoss: data.spliceLoss != null ? Number(data.spliceLoss) : null,
                connectorLoss: data.connectorLoss != null ? Number(data.connectorLoss) : null,
                spliceCount: data.spliceCount != null ? Number(data.spliceCount) : null,
                eventCount: data.eventCount != null ? Number(data.eventCount) : null,
                lossLimit: data.lossLimit != null ? Number(data.lossLimit) : null,
                orlLimit: data.orlLimit != null ? Number(data.orlLimit) : null,
                autoResult: data.autoResult ?? null,
                failureReason: data.failureReason ?? null,
                testedById: data.testedById,
                equipmentModel: data.equipmentModel ?? null,
                equipmentSerial: data.equipmentSerial ?? null,
                remarks: data.remarks ?? null,
                status: data.status ?? 'PENDING_REVIEW',
            },
        });
    }
}