const fs = require('fs');
const path = require('path');

const vmPath = path.join(__dirname, '..', '..', 'prisma', 'schema', 'vehicle-management.prisma');
let content = fs.readFileSync(vmPath, 'utf8');

// Replace monetary float fields with Decimal
const replacements = [
  { from: /rentAmount\s+Float\?/g, to: 'rentAmount      Decimal?                    @db.Decimal(14, 2)' },
  { from: /fuelLimit\s+Float\?/g, to: 'fuelLimit       Decimal?                    @db.Decimal(14, 2)' },
  { from: /purchase_cost\s+Float\?/g, to: 'purchase_cost            Decimal?           @db.Decimal(14, 2)' },
  { from: /purchase_cost\s+Float/g, to: 'purchase_cost            Decimal            @db.Decimal(14, 2)' },
  { from: /insurance_cost_annual\s+Float\?/g, to: 'insurance_cost_annual    Decimal?           @db.Decimal(14, 2)' },
  { from: /fuel_cost_per_liter\s+Float\?/g, to: 'fuel_cost_per_liter      Decimal?           @db.Decimal(10, 2)' },
  { from: /book_value\s+Float/g, to: 'book_value                Decimal            @db.Decimal(14, 2)' },
  { from: /salvage_value\s+Float/g, to: 'salvage_value             Decimal            @db.Decimal(14, 2)' },
  { from: /loan_amount\s+Float\?/g, to: 'loan_amount               Decimal?           @db.Decimal(14, 2)' },
  { from: /loan_remaining\s+Float\?/g, to: 'loan_remaining            Decimal?           @db.Decimal(14, 2)' },
  { from: /rental_cost_daily\s+Float/g, to: 'rental_cost_daily          Decimal            @db.Decimal(14, 2)' },
  { from: /rental_cost_weekly\s+Float\?/g, to: 'rental_cost_weekly         Decimal?           @db.Decimal(14, 2)' },
  { from: /rental_cost_monthly\s+Float\?/g, to: 'rental_cost_monthly        Decimal?           @db.Decimal(14, 2)' },
  { from: /rental_cost_monthly\s+Float/g, to: 'rental_cost_monthly        Decimal            @db.Decimal(14, 2)' },
  { from: /excess_mileage_cost_per_km\s+Float\?/g, to: 'excess_mileage_cost_per_km Decimal?           @db.Decimal(10, 2)' },
  { from: /driver_portion_monthly\s+Float\?/g, to: 'driver_portion_monthly     Decimal?           @db.Decimal(14, 2)' },
  { from: /rate_per_additional_km\s+Float\?/g, to: 'rate_per_additional_km     Decimal?           @db.Decimal(10, 2)' },
  { from: /fuel_allowance_per_km\s+Float\?/g, to: 'fuel_allowance_per_km      Decimal?           @db.Decimal(10, 2)' },
  { from: /base_rental\s+Float/g, to: 'base_rental                Decimal            @db.Decimal(14, 2)' },
  { from: /fuel_allowance_amount\s+Float/g, to: 'fuel_allowance_amount      Decimal            @db.Decimal(14, 2)' },
  { from: /driver_overtime_pay\s+Float/g, to: 'driver_overtime_pay        Decimal            @db.Decimal(14, 2)' },
  { from: /absent_deductions\s+Float/g, to: 'absent_deductions          Decimal            @db.Decimal(14, 2)' },
  { from: /additional_km_charges\s+Float/g, to: 'additional_km_charges      Decimal            @db.Decimal(14, 2)' },
  { from: /net_payment\s+Float/g, to: 'net_payment                Decimal            @db.Decimal(14, 2)' },
  { from: /base_hourly_rate\s+Float/g, to: 'base_hourly_rate       Decimal            @db.Decimal(10, 2)' },
  { from: /ot_hourly_rate\s+Float/g, to: 'ot_hourly_rate         Decimal            @db.Decimal(10, 2)' },
  { from: /regular_pay\s+Float/g, to: 'regular_pay            Decimal            @db.Decimal(14, 2)' },
  { from: /ot_pay\s+Float/g, to: 'ot_pay                 Decimal            @db.Decimal(14, 2)' },
  { from: /total_pay\s+Float/g, to: 'total_pay              Decimal            @db.Decimal(14, 2)' }
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(vmPath, content, 'utf8');
console.log('Successfully updated vehicle-management.prisma monetary fields to Decimal');
