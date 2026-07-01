/**
 * RentalPaymentService - Monthly Rented Vehicle Payment Summary Calculations
 * 
 * Handles:
 * - Preview (aggregate) monthly summary from VMVehicleLog and VMDriverOT
 * - Save/Submit monthly summary with workflow approval stages
 * 
 * Calculation formulas:
 *   Base Rental          = rental_cost_monthly + (driver_portion_monthly ?? 0)
 *   Fuel Allowance       = adjusted_mileage × fuel_allowance_per_km (if fuel_supplying === "OWNER")
 *   Driver Overtime Pay  = total OT hours cost from VMDriverOT
 *   Absent Deductions    = absent_days × absent_deduction_rate
 *   Additional KM Charges = over_limit_km × rate_per_additional_km
 *   Net Payment          = Base Rental + Fuel Allowance + OT - Deductions + Additional KM
 */

import { prisma as db } from '@/lib/prisma';
import { SummaryStatus } from '@/types/rental-payment.types';

export interface MonthlySummaryInput {
  rentalVehicleId: string;
  year: number;
  month: number;
}

interface DbRentalVehicle {
  id: string;
  vehicle_id: string;
  supplier_id: string;
  rental_contract_id: string;
  rental_start_date: Date;
  rental_end_date: Date;
  rental_cost_daily: number;
  rental_cost_monthly: number | null;
  fuel_included: boolean;
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  driver_term: string | null;
  fuel_supplying: string | null;
  fuel_efficiency: number | null;
  mileage_limit_monthly: number | null;
  excess_mileage_cost_per_km: number | null;
  vehicle: {
    id: string;
    registration_number: string;
    make: string;
    model: string;
    site?: { id: string; name: string } | null;
  };
}

interface DbVehicleLog {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_time: Date;
  end_time: Date | null;
  start_odometer: number;
  end_odometer: number | null;
  status: string;
}

interface DbDriverOT {
  id: string;
  driver_id: string;
  date: Date;
  total_pay: number;
  status: string;
}

interface DbMonthlySummary {
  id: string;
  rentalVehicleId: string;
  year: number;
  month: number;
  rental_cost_monthly: number;
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  fuel_supplying: string | null;
  fuel_efficiency: number | null;
  mileage_limit_monthly: number | null;
  excess_mileage_cost_per_km: number | null;
  fuel_included: boolean;
  total_days_worked: number | null;
  absent_days: number | null;
  total_km_traveled: number | null;
  base_rental: number;
  fuel_allowance_amount: number;
  driver_overtime_pay: number;
  absent_deductions: number;
  additional_km_charges: number;
  net_payment: number;
  status: string;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
  prepared_at: Date | null;
  checked_by_id: string | null;
  checked_by_name: string | null;
  checked_at: Date | null;
  checked_remarks: string | null;
  recommended_by_id: string | null;
  recommended_by_name: string | null;
  recommended_at: Date | null;
  recommended_remarks: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  rentalVehicle?: {
    id: string;
    vehicle: {
      id: string;
      registration_number: string;
      make: string;
      model: string;
    };
  };
}

interface CustomPrismaClient {
  vMRentalVehicle: {
    findUnique(args: unknown): Promise<unknown>;
  };
  vMVehicleLog: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vMDriverOT: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vMRentedVehicleMonthlySummary: {
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
  };
}

const prisma = db as unknown as CustomPrismaClient;

export interface MonthlySummaryPreview {
  rentalVehicle: DbRentalVehicle;
  year: number;
  month: number;
  rental_cost_monthly: number;
  driver_portion_monthly: number | null;
  expected_working_days: number | null;
  rate_per_additional_km: number | null;
  absent_deduction_rate: number | null;
  fuel_allowance_per_km: number | null;
  fuel_supplying: string | null;
  fuel_efficiency: number | null;
  mileage_limit_monthly: number | null;
  excess_mileage_cost_per_km: number | null;
  fuel_included: boolean;
  total_days_worked: number;
  absent_days: number;
  total_km_traveled: number;
  base_rental: number;
  fuel_allowance_amount: number;
  driver_overtime_pay: number;
  absent_deductions: number;
  additional_km_charges: number;
  net_payment: number;
  vehicle_logs_count: number;
  driver_ot_count: number;
}

class RentalPaymentService {
  /**
   * Preview (calculate) the monthly summary without saving
   */
  async previewSummary(input: MonthlySummaryInput): Promise<MonthlySummaryPreview> {
    const { rentalVehicleId, year, month } = input;

    const rentalVehicle = (await prisma.vMRentalVehicle.findUnique({
      where: { id: rentalVehicleId },
      include: {
        vehicle: {
          include: {
            site: true,
          },
        },
      },
    })) as DbRentalVehicle | null;

    if (!rentalVehicle) {
      throw new Error(`Rental vehicle not found: ${rentalVehicleId}`);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const vehicleLogs = (await prisma.vMVehicleLog.findMany({
      where: {
        vehicle_id: rentalVehicle.vehicle_id,
        start_time: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
    })) as DbVehicleLog[];

    const driverIds = Array.from(new Set(vehicleLogs.map((log) => log.driver_id)));

    const driverOTs = (await prisma.vMDriverOT.findMany({
      where: {
        driver_id: { in: driverIds },
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'APPROVED',
      },
    })) as DbDriverOT[];

    const daysWorkedSet = new Set<string>();
    vehicleLogs.forEach((log) => {
      const logDate = new Date(log.start_time);
      daysWorkedSet.add(`${logDate.getFullYear()}-${logDate.getMonth()}-${logDate.getDate()}`);
    });
    const total_days_worked = daysWorkedSet.size;

    const expectedDays = rentalVehicle.expected_working_days;
    const absent_days = expectedDays ? Math.max(0, expectedDays - total_days_worked) : 0;

    let total_km_traveled = 0;
    vehicleLogs.forEach((log) => {
      if (log.end_odometer && log.start_odometer) {
        total_km_traveled += log.end_odometer - log.start_odometer;
      }
    });

    const monthlyRate = rentalVehicle.rental_cost_monthly ?? rentalVehicle.rental_cost_daily * 30;
    const driverPortion = rentalVehicle.driver_portion_monthly ?? 0;
    const base_rental = monthlyRate + driverPortion;

    let fuel_allowance_amount = 0;
    if (rentalVehicle.fuel_supplying === 'OWNER' && rentalVehicle.fuel_allowance_per_km) {
      fuel_allowance_amount = total_km_traveled * rentalVehicle.fuel_allowance_per_km;
    }

    let driver_overtime_pay = 0;
    driverOTs.forEach((ot) => {
      driver_overtime_pay += ot.total_pay || 0;
    });

    const deductionRate = rentalVehicle.absent_deduction_rate ?? 0;
    const absent_deductions = absent_days * deductionRate;

    let additional_km_charges = 0;
    const mileageLimit = rentalVehicle.mileage_limit_monthly;
    if (mileageLimit && total_km_traveled > mileageLimit) {
      const overLimitKm = total_km_traveled - mileageLimit;
      const ratePerAdditionalKm = rentalVehicle.rate_per_additional_km ?? rentalVehicle.excess_mileage_cost_per_km ?? 0;
      additional_km_charges = overLimitKm * ratePerAdditionalKm;
    }

    const net_payment = base_rental + fuel_allowance_amount + driver_overtime_pay - absent_deductions + additional_km_charges;

    return {
      rentalVehicle,
      year,
      month,
      rental_cost_monthly: monthlyRate,
      driver_portion_monthly: rentalVehicle.driver_portion_monthly,
      expected_working_days: rentalVehicle.expected_working_days,
      rate_per_additional_km: rentalVehicle.rate_per_additional_km ?? rentalVehicle.excess_mileage_cost_per_km,
      absent_deduction_rate: rentalVehicle.absent_deduction_rate,
      fuel_allowance_per_km: rentalVehicle.fuel_allowance_per_km,
      fuel_supplying: rentalVehicle.fuel_supplying,
      fuel_efficiency: rentalVehicle.fuel_efficiency,
      mileage_limit_monthly: rentalVehicle.mileage_limit_monthly,
      excess_mileage_cost_per_km: rentalVehicle.excess_mileage_cost_per_km,
      fuel_included: rentalVehicle.fuel_included,
      total_days_worked,
      absent_days,
      total_km_traveled,
      base_rental,
      fuel_allowance_amount,
      driver_overtime_pay,
      absent_deductions,
      additional_km_charges,
      net_payment,
      vehicle_logs_count: vehicleLogs.length,
      driver_ot_count: driverOTs.length,
    };
  }

  /**
   * Get existing monthly summary by rental vehicle, year, month
   */
  async getSummary(rentalVehicleId: string, year: number, month: number): Promise<DbMonthlySummary | null> {
    return (await prisma.vMRentedVehicleMonthlySummary.findUnique({
      where: {
        rentalVehicleId_year_month: {
          rentalVehicleId,
          year,
          month,
        },
      },
      include: {
        rentalVehicle: {
          include: {
            vehicle: true,
          },
        },
      },
    })) as DbMonthlySummary | null;
  }

  /**
   * List summaries for a rental vehicle
   */
  async listSummaries(rentalVehicleId: string): Promise<DbMonthlySummary[]> {
    return (await prisma.vMRentedVehicleMonthlySummary.findMany({
      where: { rentalVehicleId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        rentalVehicle: {
          include: {
            vehicle: {
              select: {
                id: true,
                registration_number: true,
                make: true,
                model: true,
              },
            },
          },
        },
      },
    })) as DbMonthlySummary[];
  }

  /**
   * Save (create) a new monthly summary from preview data
   */
  async saveSummary(input: MonthlySummaryInput, preparedBy?: { id: string; name: string }): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({
      where: {
        rentalVehicleId_year_month: {
          rentalVehicleId: input.rentalVehicleId,
          year: input.year,
          month: input.month,
        },
      },
    })) as DbMonthlySummary | null;

    if (existing) {
      throw new Error(`Summary already exists for ${input.year}-${input.month}. Use update instead.`);
    }

    const preview = await this.previewSummary(input);

    const updateData = {
      rentalVehicleId: input.rentalVehicleId,
      year: input.year,
      month: input.month,
      rental_cost_monthly: preview.rental_cost_monthly,
      driver_portion_monthly: preview.driver_portion_monthly,
      expected_working_days: preview.expected_working_days,
      rate_per_additional_km: preview.rate_per_additional_km,
      absent_deduction_rate: preview.absent_deduction_rate,
      fuel_allowance_per_km: preview.fuel_allowance_per_km,
      fuel_supplying: preview.fuel_supplying,
      fuel_efficiency: preview.fuel_efficiency,
      mileage_limit_monthly: preview.mileage_limit_monthly,
      excess_mileage_cost_per_km: preview.excess_mileage_cost_per_km,
      fuel_included: preview.fuel_included,
      total_days_worked: preview.total_days_worked,
      absent_days: preview.absent_days,
      total_km_traveled: preview.total_km_traveled,
      base_rental: preview.base_rental,
      fuel_allowance_amount: preview.fuel_allowance_amount,
      driver_overtime_pay: preview.driver_overtime_pay,
      absent_deductions: preview.absent_deductions,
      additional_km_charges: preview.additional_km_charges,
      net_payment: preview.net_payment,
      status: 'DRAFT',
      prepared_by_id: preparedBy?.id || null,
      prepared_by_name: preparedBy?.name || null,
      prepared_at: preparedBy ? new Date() : null,
    };

    return (await prisma.vMRentedVehicleMonthlySummary.create({ data: updateData })) as DbMonthlySummary;
  }

  /**
   * Update summary (only if DRAFT)
   */
  async updateSummary(id: string, input: MonthlySummaryInput): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`Cannot update summary with status: ${existing.status}. Only DRAFT summaries can be updated.`);
    }

    const preview = await this.previewSummary(input);

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: {
        rental_cost_monthly: preview.rental_cost_monthly,
        driver_portion_monthly: preview.driver_portion_monthly,
        expected_working_days: preview.expected_working_days,
        rate_per_additional_km: preview.rate_per_additional_km,
        absent_deduction_rate: preview.absent_deduction_rate,
        fuel_allowance_per_km: preview.fuel_allowance_per_km,
        fuel_supplying: preview.fuel_supplying,
        fuel_efficiency: preview.fuel_efficiency,
        mileage_limit_monthly: preview.mileage_limit_monthly,
        excess_mileage_cost_per_km: preview.excess_mileage_cost_per_km,
        fuel_included: preview.fuel_included,
        total_days_worked: preview.total_days_worked,
        absent_days: preview.absent_days,
        total_km_traveled: preview.total_km_traveled,
        base_rental: preview.base_rental,
        fuel_allowance_amount: preview.fuel_allowance_amount,
        driver_overtime_pay: preview.driver_overtime_pay,
        absent_deductions: preview.absent_deductions,
        additional_km_charges: preview.additional_km_charges,
        net_payment: preview.net_payment,
      },
    })) as DbMonthlySummary;
  }

  /**
   * Submit summary (move from DRAFT to SUBMITTED)
   */
  async submitSummary(id: string, submittedBy?: { id: string; name: string }): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`Cannot submit summary with status: ${existing.status}. Only DRAFT can be submitted.`);
    }

    const updateData = {
      status: 'SUBMITTED',
      prepared_by_id: submittedBy?.id || existing.prepared_by_id,
      prepared_by_name: submittedBy?.name || existing.prepared_by_name,
      prepared_at: submittedBy ? new Date() : existing.prepared_at,
    };

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: updateData,
    })) as DbMonthlySummary;
  }

  /**
   * Check (Technical Assistant approval) - moves from SUBMITTED to CHECKED
   */
  async checkSummary(id: string, checkedBy: { id: string; name: string }, remarks?: string): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'SUBMITTED') {
      throw new Error(`Cannot check summary with status: ${existing.status}. Only SUBMITTED can be checked.`);
    }

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: {
        status: 'CHECKED',
        checked_by_id: checkedBy.id,
        checked_by_name: checkedBy.name,
        checked_at: new Date(),
        checked_remarks: remarks || null,
      },
    })) as DbMonthlySummary;
  }

  /**
   * Recommend (Admin Executive approval) - moves from CHECKED to RECOMMENDED
   */
  async recommendSummary(id: string, recommendedBy: { id: string; name: string }, remarks?: string): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'CHECKED') {
      throw new Error(`Cannot recommend summary with status: ${existing.status}. Only CHECKED can be recommended.`);
    }

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: {
        status: 'RECOMMENDED',
        recommended_by_id: recommendedBy.id,
        recommended_by_name: recommendedBy.name,
        recommended_at: new Date(),
        recommended_remarks: remarks || null,
      },
    })) as DbMonthlySummary;
  }

  /**
   * Approve (final approval) - moves from RECOMMENDED to APPROVED
   */
  async approveSummary(id: string, approvedBy: { id: string; name: string }, remarks?: string): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'RECOMMENDED') {
      throw new Error(`Cannot approve summary with status: ${existing.status}. Only RECOMMENDED can be approved.`);
    }

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: {
        status: 'APPROVED',
        recommended_remarks: remarks || existing.recommended_remarks,
        recommended_at: new Date(),
        recommended_by_id: approvedBy.id,
        recommended_by_name: approvedBy.name,
      },
    })) as DbMonthlySummary;
  }

  /**
   * Reject summary at any stage
   */
  async rejectSummary(id: string, rejectedBy: { id: string; name: string }, reason: string): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (['APPROVED', 'REJECTED'].includes(existing.status)) {
      throw new Error(`Cannot reject summary with status: ${existing.status}`);
    }

    return (await prisma.vMRentedVehicleMonthlySummary.update({
      where: { id },
      data: {
        status: 'REJECTED',
        checked_remarks: reason,
        checked_by_id: rejectedBy.id,
        checked_by_name: rejectedBy.name,
        checked_at: new Date(),
      },
    })) as DbMonthlySummary;
  }

  /**
   * Delete summary (only DRAFT)
   */
  async deleteSummary(id: string): Promise<DbMonthlySummary> {
    const existing = (await prisma.vMRentedVehicleMonthlySummary.findUnique({ where: { id } })) as DbMonthlySummary | null;

    if (!existing) {
      throw new Error('Summary not found');
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`Cannot delete summary with status: ${existing.status}. Only DRAFT can be deleted.`);
    }

    return (await prisma.vMRentedVehicleMonthlySummary.delete({ where: { id } })) as DbMonthlySummary;
  }

  /**
   * Fetch a rental vehicle by vehicle registration ID
   */
  async getRentalVehicleByVehicleId(vehicleId: string): Promise<DbRentalVehicle | null> {
    return (await prisma.vMRentalVehicle.findUnique({
      where: { vehicle_id: vehicleId },
      include: {
        vehicle: {
          include: {
            site: true,
          },
        },
      },
    })) as DbRentalVehicle | null;
  }
}

export const rentalPaymentService = new RentalPaymentService();
export default RentalPaymentService;
