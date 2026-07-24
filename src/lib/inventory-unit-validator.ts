/**
 * Inventory Unit of Measure (UOM) Validation Utility
 *
 * Rule:
 * 1. Continuous/Fractional Units (Meters, Kilograms, Grams, Liters, Milliliters)
 *    - Decimal quantities are allowed (e.g. 45.5 Meters).
 * 2. Discrete/Countable Units (Pcs, Nos, Units, Sets, Boxes, Coils, etc.)
 *    - Quantities MUST be strict integers. Decimals are prohibited and rounded to integer.
 */

const CONTINUOUS_UNITS = new Set([
  'METERS',
  'METER',
  'M',
  'KM',
  'KILOGRAMS',
  'KILOGRAM',
  'KG',
  'GRAMS',
  'GRAM',
  'G',
  'LITERS',
  'LITER',
  'L',
  'MILLILITERS',
  'MILLILITER',
  'ML',
]);

/**
 * Checks if a given Unit of Measure allows decimal/fractional values.
 */
export function isContinuousUnit(unit: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toUpperCase();
  return CONTINUOUS_UNITS.has(normalized);
}

/**
 * Formats a quantity value based on its Unit of Measure.
 * If the unit is discrete (Pcs, Nos), it rounds to a strict Integer.
 * If continuous (Meters, Kg), it rounds to 2 decimal places.
 */
export function formatQuantityForUnit(quantity: number, unit: string): number {
  const num = Number(quantity) || 0;
  if (isContinuousUnit(unit)) {
    return Number(num.toFixed(2));
  }
  return Math.round(num);
}

/**
 * Validates whether a quantity is valid for its unit.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateUnitQuantity(quantity: number, unit: string): string | null {
  const num = Number(quantity);
  if (isNaN(num) || num < 0) {
    return 'Quantity must be a non-negative number';
  }

  if (!isContinuousUnit(unit) && !Number.isInteger(num)) {
    return `Discrete material items (${unit || 'Pcs/Nos'}) cannot have decimal quantities. Please enter a whole integer number.`;
  }

  return null;
}
