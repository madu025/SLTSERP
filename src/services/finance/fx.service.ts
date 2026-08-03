import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export class FXService {
  /**
   * Retrieves the current active exchange rate for a given currency code.
   * Defaults to 1.0 if not found (e.g., base currency LKR).
   */
  static async getCurrentRate(currencyCode: string): Promise<number> {
    if (currencyCode === 'LKR') return 1.0;
    
    const rate = await prisma.currencyExchange.findFirst({
      where: {
        currencyCode,
        isActive: true,
        effectiveDate: { lte: new Date() }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });
    
    return rate ? Number(rate.exchangeRate) : 1.0;
  }

  /**
   * Records or updates a daily exchange rate.
   */
  static async setExchangeRate(currencyCode: string, rate: number, effectiveDate: Date = new Date()) {
    // Normalize date to start of day for uniqueness
    const normalizedDate = new Date(effectiveDate);
    normalizedDate.setHours(0, 0, 0, 0);

    return prisma.currencyExchange.upsert({
      where: {
        currencyCode_effectiveDate: {
          currencyCode,
          effectiveDate: normalizedDate
        }
      },
      update: {
        exchangeRate: rate,
        isActive: true
      },
      create: {
        currencyCode,
        exchangeRate: rate,
        effectiveDate: normalizedDate,
        isActive: true
      }
    });
  }

  /**
   * Calculates Realized FX Gain/Loss for a payment.
   * If an AP invoice was booked at 300 LKR/USD and paid at 320 LKR/USD,
   * there is an FX Loss of 20 LKR per USD.
   */
  static calculateRealizedGainLoss(
    foreignAmount: number,
    bookedRate: number,
    paymentRate: number,
    isPayable: boolean = true
  ): number {
    const bookedLocal = foreignAmount * bookedRate;
    const paymentLocal = foreignAmount * paymentRate;
    const difference = paymentLocal - bookedLocal;

    // For Payables (AP): higher payment rate means paying more LKR -> LOSS (negative gain)
    // For Receivables (AR): higher payment rate means receiving more LKR -> GAIN (positive)
    if (isPayable) {
      return -difference; // Negative means loss, positive means gain
    } else {
      return difference;
    }
  }

  /**
   * Get all latest exchange rates
   */
  static async getAllLatestRates() {
    const currencies = await prisma.currencyExchange.groupBy({
      by: ['currencyCode'],
    });

    const rates = await Promise.all(
      currencies.map(async (c) => {
        const rate = await prisma.currencyExchange.findFirst({
          where: { currencyCode: c.currencyCode, isActive: true },
          orderBy: { effectiveDate: 'desc' }
        });
        return rate;
      })
    );

    return rates.filter(r => r !== null);
  }
}
