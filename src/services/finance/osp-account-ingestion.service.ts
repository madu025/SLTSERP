import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { safe } from '@/utils/safe-await.util';

export interface IngestionResult {
  pettyCashCount: number;
  fixedAssetCount: number;
  vehicleCount: number;
  vehiclePaymentCount: number;
  fuelDepositCount: number;
  projectAdvanceCount: number;
  iouCount: number;
  propertyRentCount: number;
  errors: string[];
}

function parseExcelDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date conversion
    const jsDate = new Date(Math.round((val - (25567 + 2)) * 86400 * 1000));
    return isNaN(jsDate.getTime()) ? null : jsDate;
  }
  if (typeof val === 'string') {
    const cleanStr = val.trim().replace(/\./g, '-').replace(/\//g, '-');
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return isNaN(dt.getTime()) ? null : dt;
      } else {
        // DD-MM-YYYY
        const dt = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        return isNaN(dt.getTime()) ? null : dt;
      }
    }
    const parsed = new Date(cleanStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalizeVehicleNo(vNo: string): string {
  return vNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function mapVehicleType(typeStr: string): 'BOOM_TRUCK' | 'DOUBLE_CAB' | 'CAB' | 'VAN' | 'MINI_VAN' | 'TRUCK' | 'CAR' | 'LORRY' {
  const upper = typeStr.toUpperCase();
  if (upper.includes('BOOM')) return 'BOOM_TRUCK';
  if (upper.includes('DOUBLE')) return 'DOUBLE_CAB';
  if (upper.includes('CAB')) return 'CAB';
  if (upper.includes('VAN')) return 'VAN';
  if (upper.includes('MINI')) return 'MINI_VAN';
  if (upper.includes('TRUCK')) return 'TRUCK';
  if (upper.includes('LORRY')) return 'LORRY';
  return 'BOOM_TRUCK';
}

export class OSPAccountIngestionService {
  private static OSP_ACCOUNT_DIR = path.join(process.cwd(), 'OSP-Account');

  /**
   * Main entry point to ingest all 12 OSP Account Excel files
   */
  static async ingestAll(): Promise<IngestionResult> {
    if (!fs.existsSync(this.OSP_ACCOUNT_DIR)) {
      throw AppError.notFound('OSP-Account directory not found');
    }

    const result: IngestionResult = {
      pettyCashCount: 0,
      fixedAssetCount: 0,
      vehicleCount: 0,
      vehiclePaymentCount: 0,
      fuelDepositCount: 0,
      projectAdvanceCount: 0,
      iouCount: 0,
      propertyRentCount: 0,
      errors: []
    };

    const opmcs = await prisma.oPMC.findMany();
    const defaultOpmcId = opmcs.length > 0 ? opmcs[0].id : null;

    // 1. Ingest Petty Cash Reimbursement Reports (Anuradhapura, Gampaha, Cancel Vouchers)
    const [pcErr, pcCount] = await safe(this.ingestPettyCash(defaultOpmcId));
    if (pcErr) {
      const msg = pcErr instanceof Error ? pcErr.message : String(pcErr);
      result.errors.push(`Petty Cash Ingestion Error: ${msg}`);
    } else if (pcCount !== null) {
      result.pettyCashCount = pcCount;
    }

    // 2. Ingest Fixed Assets Verification
    const [faErr, faCount] = await safe(this.ingestFixedAssets());
    if (faErr) {
      const msg = faErr instanceof Error ? faErr.message : String(faErr);
      result.errors.push(`Fixed Asset Ingestion Error: ${msg}`);
    } else if (faCount !== null) {
      result.fixedAssetCount = faCount;
    }

    // 3. Ingest Fleet Vehicles, Hiring Payments & Fuel Deposits
    const [vehErr, vehicleStats] = await safe(this.ingestVehiclesAndDeposits(defaultOpmcId));
    if (vehErr) {
      const msg = vehErr instanceof Error ? vehErr.message : String(vehErr);
      result.errors.push(`Vehicle Fleet Ingestion Error: ${msg}`);
    } else if (vehicleStats) {
      result.vehicleCount = vehicleStats.vehicleCount;
      result.vehiclePaymentCount = vehicleStats.paymentCount;
      result.fuelDepositCount = vehicleStats.depositCount;
    }

    // 4. Ingest Project Advances, IOUs & Property Rent
    const [advErr, advanceStats] = await safe(this.ingestAdvancesAndIOUs(defaultOpmcId));
    if (advErr) {
      const msg = advErr instanceof Error ? advErr.message : String(advErr);
      result.errors.push(`Advances & IOU Ingestion Error: ${msg}`);
    } else if (advanceStats) {
      result.projectAdvanceCount = advanceStats.advanceCount;
      result.iouCount = advanceStats.iouCount;
      result.propertyRentCount = advanceStats.rentCount;
    }

    return result;
  }

  /**
   * 1. Petty Cash Ingestion
   */
  private static async ingestPettyCash(defaultOpmcId: string | null): Promise<number> {
    let count = 0;
    const files = [
      'Analysis Rpt for Reimbursement Anuradhapura 1.xlsx',
      'Analysis Rpt for Reimbursement Gampaha 1.xlsx'
    ];

    for (const fileName of files) {
      const filePath = path.join(this.OSP_ACCOUNT_DIR, fileName);
      if (!fs.existsSync(filePath)) continue;

      const wb = XLSX.readFile(filePath);
      const isAnuradhapura = fileName.includes('Anuradhapura');
      const opmcName = isAnuradhapura ? 'Anuradhapura' : 'Gampaha';

      let accountId: string | null = null;
      if (defaultOpmcId) {
        let pcAccount = await prisma.pettyCashAccount.findFirst({
          where: { name: { contains: opmcName, mode: 'insensitive' } }
        });
        if (!pcAccount) {
          pcAccount = await prisma.pettyCashAccount.create({
            data: {
              name: `OSP Petty Cash - ${opmcName}`,
              opmcId: defaultOpmcId,
              imprestLimit: 200000,
              currentBalance: 200000
            }
          });
        }
        accountId = pcAccount.id;
      }

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });
        if (rows.length < 5) continue;

        for (let i = 4; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;

          const dateVal = row[0];
          const desc = String(row[1] || '').trim();
          const voucherNoRaw = row[2];
          const totalExpRaw = row[4];

          if (!desc || !voucherNoRaw) continue;

          const voucherNo = String(voucherNoRaw).trim();
          const totalExp = typeof totalExpRaw === 'number' ? totalExpRaw : parseFloat(String(totalExpRaw)) || 0;
          const vDate = parseExcelDate(dateVal) || new Date();

          if (totalExp <= 0 && !desc.toLowerCase().includes('balance')) continue;

          const subsist = typeof row[5] === 'number' ? row[5] : 0;
          const welfare = typeof row[6] === 'number' ? row[6] : 0;
          const transport = typeof row[7] === 'number' ? row[7] : 0;

          let category = 'MISCELLANEOUS';
          if (welfare > 0) category = 'STAFF_WELFARE';
          else if (transport > 0) category = 'TRAVEL_TRANSPORT';
          else if (subsist > 0) category = 'SUBSISTENCE';

          if (accountId) {
            const existingVoucher = await prisma.pettyCashVoucher.findFirst({
              where: { voucherNumber: voucherNo, accountId }
            });

            if (!existingVoucher) {
              await prisma.pettyCashVoucher.create({
                data: {
                  voucherNumber: voucherNo,
                  accountId,
                  title: desc,
                  amount: totalExp > 0 ? totalExp : 0,
                  category,
                  description: `Imported from ${fileName} (${sheetName})`,
                  status: 'APPROVED',
                  approvedAt: vDate,
                  createdAt: vDate
                }
              });
              count++;
            }
          }
        }
      }
    }

    const cancelFile = path.join(this.OSP_ACCOUNT_DIR, 'Petty Cash Cancel Vouchers.xlsx');
    if (fs.existsSync(cancelFile)) {
      const wb = XLSX.readFile(cancelFile);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const voucherNo = String(row[0]).trim();
        const reason = String(row[2] || 'Cancelled voucher').trim();

        await prisma.pettyCashVoucher.updateMany({
          where: { voucherNumber: voucherNo },
          data: {
            status: 'REJECTED',
            rejectionReason: reason
          }
        });
      }
    }

    return count;
  }

  /**
   * 2. Fixed Asset Verification Ingestion
   */
  private static async ingestFixedAssets(): Promise<number> {
    let count = 0;
    const fileName = 'Final - OSP & SI Fixed Assets Verification.xlsx';
    const filePath = path.join(this.OSP_ACCOUNT_DIR, fileName);
    if (!fs.existsSync(filePath)) return 0;

    const wb = XLSX.readFile(filePath);

    for (const sheetName of wb.SheetNames) {
      if (sheetName === 'Content' || sheetName === 'General Description' || sheetName === 'Assets Coding System' || sheetName === 'Sheet1') {
        continue;
      }

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });
      if (rows.length < 6) continue;

      let locName = `Location ${sheetName}`;
      if (rows[1] && rows[1][0]) {
        locName = String(rows[1][0]).trim();
      }

      for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;

        const groupDesc = String(row[0] || '').trim();
        const groupCode = String(row[1] || '').trim();
        const subGroupDesc = String(row[2] || '').trim();
        const subGroupCode = String(row[3] || '').trim();
        const yearKnown = row[4];
        const yearUnknown = row[5];
        const details = String(row[6] || '').trim();
        const atnRaw = row[7] ? String(row[7]).trim() : null;

        if (!groupCode && !subGroupCode && !details && !atnRaw) continue;

        const yearStr = yearKnown ? String(yearKnown) : yearUnknown ? String(yearUnknown) : '2021';
        const assetNo = atnRaw || `${sheetName}/${yearStr}/${groupCode || 'GEN'}/${subGroupCode || 'ITEM'}/${String(i).padStart(3, '0')}`;

        await prisma.fixedAsset.upsert({
          where: { assetNumber: assetNo },
          update: {
            name: `${subGroupDesc || groupDesc || 'Asset'} - ${details || 'Verified Asset'}`.slice(0, 150),
            category: groupCode || 'EQUIPMENT',
            subCategory: subGroupCode || undefined,
            purchasedYear: yearStr,
            locationCode: sheetName,
            locationName: locName,
            details: details || null,
            status: 'ACTIVE',
            verifiedAt: new Date()
          },
          create: {
            assetNumber: assetNo,
            name: `${subGroupDesc || groupDesc || 'Asset'} - ${details || 'Verified Asset'}`.slice(0, 150),
            category: groupCode || 'EQUIPMENT',
            subCategory: subGroupCode || undefined,
            purchasedYear: yearStr,
            cost: 0,
            locationCode: sheetName,
            locationName: locName,
            details: details || null,
            status: 'ACTIVE',
            verifiedAt: new Date()
          }
        });
        count++;
      }
    }

    return count;
  }

  /**
   * 3. Vehicle Fleet, Hiring Payments & Fuel Deposits Ingestion
   */
  private static async ingestVehiclesAndDeposits(defaultOpmcId: string | null): Promise<{
    vehicleCount: number;
    paymentCount: number;
    depositCount: number;
  }> {
    let vehicleCount = 0;
    let paymentCount = 0;
    let depositCount = 0;

    // Ensure a default VMSite exists
    let defaultSite = await prisma.vMSite.findFirst();
    if (!defaultSite) {
      defaultSite = await prisma.vMSite.create({
        data: {
          name: 'OSP Main Fleet Center',
          code: 'OSP-MAIN',
          address: 'Kaduwela Office Premises',
          city: 'Kaduwela',
          state: 'Western',
          postal_code: '10110',
          country: 'LK',
          latitude: 6.9,
          longitude: 79.9,
          contact_person: 'Fleet Manager',
          phone: '0112000000',
          email: 'fleet@slts.lk',
          manager_id: 'SYSTEM'
        }
      });
    }

    const vehicleFile = path.join(this.OSP_ACCOUNT_DIR, 'Vehicle List 2025 10 30.xlsx');
    if (fs.existsSync(vehicleFile)) {
      const wb = XLSX.readFile(vehicleFile);
      const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2]) continue;

        const vNo = String(row[2]).trim();
        const vTypeRaw = String(row[3] || 'BOOM_TRUCK').trim();
        const cleanNo = normalizeVehicleNo(vNo);

        const existingV = await prisma.vMVehicle.findFirst({
          where: { registration_number: cleanNo }
        });

        if (!existingV) {
          await prisma.vMVehicle.create({
            data: {
              registration_number: cleanNo,
              chassis_number: `CHS-${cleanNo}`,
              engine_number: `ENG-${cleanNo}`,
              make: 'OSP Fleet',
              model: vTypeRaw,
              year: 2020,
              color: 'WHITE',
              vehicle_type: mapVehicleType(vTypeRaw),
              ownership: 'RENTAL',
              status: 'AVAILABLE',

              capacity_passengers: 2,
              capacity_cargo_weight_kg: 1000,
              capacity_cargo_volume_m3: 5,
              site_id: defaultSite.id,
              registration_date: new Date()
            }
          });
          vehicleCount++;
        }
      }
    }

    const hiringFile = path.join(this.OSP_ACCOUNT_DIR, 'Hiring Vehicle Payments Detail - 12.02.2026 - Mr.Kalana.xlsx');
    if (fs.existsSync(hiringFile)) {
      const wb = XLSX.readFile(hiringFile);
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;

          const bankCode = String(row[0] || '').trim();
          const accNo = String(row[2] || '').trim();
          const accName = String(row[3] || sheetName).trim();
          const amount = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4])) || 0;
          const slipNo = String(row[5] || `SLIP-${i}`).trim();
          const slipDateVal = row[6];
          const paidDateVal = row[7];

          if (amount <= 0 || !accName) continue;

          const sDate = parseExcelDate(slipDateVal);
          const pDate = parseExcelDate(paidDateVal) || new Date();

          await prisma.ospVehicleHiringPayment.upsert({
            where: {
              accountName_slipNo: {
                accountName: accName,
                slipNo: slipNo
              }
            },
            update: {
              bankCode,
              accountNo: accNo,
              amount,
              slipDate: sDate,
              paidDate: pDate,
              opmcId: defaultOpmcId
            },
            create: {
              accountName: accName,
              bankCode,
              accountNo: accNo,
              amount,
              slipNo,
              slipDate: sDate,
              paidDate: pDate,
              opmcId: defaultOpmcId
            }
          });
          paymentCount++;
        }
      }
    }

    const fuelFile = path.join(this.OSP_ACCOUNT_DIR, 'Fuel Deposit.xlsx');
    if (fs.existsSync(fuelFile)) {
      const wb = XLSX.readFile(fuelFile);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const office = String(row[0] || '').trim();
        const station = String(row[1] || '').trim();
        const deposit = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2])) || 0;

        if (!office || !station || deposit <= 0) continue;

        await prisma.ospFuelDepositLedger.upsert({
          where: {
            officeLocation_stationName: {
              officeLocation: office,
              stationName: station
            }
          },
          update: {
            actualDeposit: deposit,
            opmcId: defaultOpmcId
          },
          create: {
            officeLocation: office,
            stationName: station,
            actualDeposit: deposit,
            opmcId: defaultOpmcId
          }
        });
        depositCount++;
      }
    }

    return { vehicleCount, paymentCount, depositCount };
  }

  /**
   * 4. Project Advances, IOUs & Property Rent Ingestion
   */
  private static async ingestAdvancesAndIOUs(defaultOpmcId: string | null): Promise<{
    advanceCount: number;
    iouCount: number;
    rentCount: number;
  }> {
    let advanceCount = 0;
    let iouCount = 0;
    let rentCount = 0;

    const advFile = path.join(this.OSP_ACCOUNT_DIR, 'Project Advance Payment.xlsx');
    if (fs.existsSync(advFile)) {
      const wb = XLSX.readFile(advFile);
      const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;

        const refNo = String(row[0]).trim();
        const type = String(row[1] || 'Project').trim();
        const supplier = String(row[2] || '').trim();
        const desc = String(row[3] || '').trim();
        const invNo = String(row[4] || refNo).trim();
        const amt = typeof row[5] === 'number' ? row[5] : parseFloat(String(row[5])) || 0;
        const vat = typeof row[6] === 'number' ? row[6] : parseFloat(String(row[6])) || 0;
        const total = typeof row[7] === 'number' ? row[7] : parseFloat(String(row[7])) || amt + vat;

        if (amt <= 0) continue;

        await prisma.ospProjectAdvance.upsert({
          where: { refNumber: refNo },
          update: {
            type,
            supplierName: supplier,
            description: desc,
            invoiceNo: invNo,
            amount: amt,
            vatAmount: vat,
            totalAmount: total,
            opmcId: defaultOpmcId
          },
          create: {
            refNumber: refNo,
            type,
            supplierName: supplier,
            description: desc,
            invoiceNo: invNo,
            amount: amt,
            vatAmount: vat,
            totalAmount: total,
            opmcId: defaultOpmcId
          }
        });
        advanceCount++;
      }
    }

    const iouFile = path.join(this.OSP_ACCOUNT_DIR, 'IOU-2026 03.04.2026.xlsx');
    if (fs.existsSync(iouFile)) {
      const wb = XLSX.readFile(iouFile);
      for (const sheetName of ['03.04.2026', 'IOU-Petty Cash', 'IOU-Project Adv', 'Sheet2']) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4) continue;

          const type = String(row[0] || 'Project advance').trim();
          const iouNo = String(row[1] || `IOU-${i}`).trim();
          const staff = String(row[2] || '').trim();
          const amt = typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3])) || 0;
          const obtainDateVal = row[4];
          const reason = String(row[5] || '').trim();
          const days = typeof row[6] === 'number' ? row[6] : parseInt(String(row[6])) || 0;
          const remarks = String(row[7] || '').trim();

          if (!staff || amt <= 0) continue;

          const iDate = parseExcelDate(obtainDateVal) || new Date();

          await prisma.ospPettyCashIou.upsert({
            where: {
              iouNumber_staffName: {
                iouNumber: iouNo,
                staffName: staff
              }
            },
            update: {
              type,
              amount: amt,
              issuedDate: iDate,
              reason: reason || null,
              noOfDays: days,
              remarks: remarks || null,
              opmcId: defaultOpmcId
            },
            create: {
              iouNumber: iouNo,
              staffName: staff,
              type,
              amount: amt,
              issuedDate: iDate,
              reason: reason || null,
              noOfDays: days,
              remarks: remarks || null,
              opmcId: defaultOpmcId
            }
          });
          iouCount++;
        }
      }
    }

    const rentFile = path.join(this.OSP_ACCOUNT_DIR, 'KD Office & Land payments Detail.xlsx');
    if (fs.existsSync(rentFile)) {
      const wb = XLSX.readFile(rentFile);
      const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Array<string | number>>(ws, { header: 1 });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 7) continue;

        const accNo = String(row[2] || '').trim();
        const supplier = String(row[3] || '').trim();
        const amt = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4])) || 0;
        const category = String(row[5] || 'Office Rent').trim();
        const slipNo = String(row[6] || `SLIP-${i}`).trim();
        const slipDateVal = row[7];

        if (!supplier || amt <= 0) continue;

        const sDate = parseExcelDate(slipDateVal) || new Date();

        await prisma.ospPropertyRentPayment.upsert({
          where: {
            supplierName_slipNo: {
              supplierName: supplier,
              slipNo: slipNo
            }
          },
          update: {
            accountNo: accNo,
            amount: amt,
            category,
            slipDate: sDate,
            opmcId: defaultOpmcId
          },
          create: {
            accountNo: accNo,
            supplierName: supplier,
            amount: amt,
            category,
            slipNo,
            slipDate: sDate,
            opmcId: defaultOpmcId
          }
        });
        rentCount++;
      }
    }

    return { advanceCount, iouCount, rentCount };
  }
}
