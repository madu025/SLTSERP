import { rentalPaymentService } from '../src/services/RentalPaymentService';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('[TEST] Starting backend running tests for Rental Agreement & Bank Details...');

  let siteId: string;
  let vehicleId: string;
  let isTempSiteCreated = false;
  let isTempVehicleCreated = false;

  // 1. Fetch or create a temporary VMSite
  let site = await prisma.vMSite.findFirst();
  if (!site) {
    console.log('[TEST] No site found. Creating a temporary site...');
    site = await prisma.vMSite.create({
      data: {
        name: 'Gampaha Test Site',
        code: 'SITE-TEST-099',
        address: 'Gampaha Road',
        city: 'Gampaha',
        state: 'Western',
        postal_code: '11000',
        country: 'Sri Lanka',
        latitude: 7.0873,
        longitude: 80.0143,
        contact_person: 'Test Coordinator',
        phone: '0332299887',
        email: 'testsite@slt.lk',
        manager_id: 'manager-1234',
        status: 'ACTIVE',
        vehicle_pool_capacity: 10
      }
    });
    isTempSiteCreated = true;
    console.log(`[TEST] Temporary site created with ID: ${site.id}`);
  }
  siteId = site.id;

  // 2. Fetch or create a temporary VMVehicle (RENTAL type)
  let vehicle = await prisma.vMVehicle.findFirst({
    where: { ownership: 'RENTAL' }
  });

  if (!vehicle) {
    console.log('[TEST] No RENTAL vehicle found. Creating a temporary RENTAL vehicle...');
    vehicle = await prisma.vMVehicle.create({
      data: {
        registration_number: 'WP-TEST-9988',
        chassis_number: 'CHAS-TEST-998877',
        engine_number: 'ENG-TEST-998877',
        make: 'Toyota',
        model: 'HiAce',
        year: 2022,
        color: 'White',
        vehicle_type: 'VAN',
        ownership: 'RENTAL',
        status: 'AVAILABLE',
        capacity_passengers: 14,
        capacity_cargo_weight_kg: 1000,
        capacity_cargo_volume_m3: 6.5,
        site_id: siteId,
        registration_date: new Date()
      }
    });
    isTempVehicleCreated = true;
    console.log(`[TEST] Temporary vehicle created with ID: ${vehicle.id}`);
  }
  vehicleId = vehicle.id;

  // 3. Perform upsertRentalVehicle test
  const testPayload = {
    supplier_id: 'SUPPLIER-TEST-001',
    supplier_contact: '0779998887',
    rental_contract_id: 'CON-TEST-XYZ-123',
    rental_start_date: '2026-01-01',
    rental_end_date: '2026-12-31',
    rental_cost_monthly: 95000,
    rental_cost_daily: 3500,
    driver_portion_monthly: 20000,
    driver_term: 'WITH_DRIVER',
    fuel_supplying: 'OWNER',
    bank_name: 'Commercial Bank of Ceylon',
    bank_account_number: '9876543210',
    bank_branch: 'Colombo 03',
    bank_branch_code: '085',
    document_url: 'https://example.com/agreement-test.pdf'
  };

  console.log('[TEST] Executing upsertRentalVehicle...');
  const result = await rentalPaymentService.upsertRentalVehicle(vehicleId, testPayload);
  
  if (!result) {
    throw new Error('upsertRentalVehicle returned null or undefined');
  }
  console.log('[TEST] Agreement details saved successfully!');

  // 4. Retrieve using getRentalVehicleByVehicleId
  console.log('[TEST] Executing getRentalVehicleByVehicleId...');
  const retrieved = await rentalPaymentService.getRentalVehicleByVehicleId(vehicleId);

  if (!retrieved) {
    throw new Error('getRentalVehicleByVehicleId returned null');
  }

  // 5. Assert values match
  console.log('[TEST] Asserting saved values...');
  if (retrieved.rental_contract_id !== testPayload.rental_contract_id) {
    throw new Error(`Assert failed: contract_id mismatch. Expected ${testPayload.rental_contract_id}, got ${retrieved.rental_contract_id}`);
  }
  if (retrieved.bank_name !== testPayload.bank_name) {
    throw new Error(`Assert failed: bank_name mismatch. Expected ${testPayload.bank_name}, got ${retrieved.bank_name}`);
  }
  if (retrieved.document_url !== testPayload.document_url) {
    throw new Error(`Assert failed: document_url mismatch. Expected ${testPayload.document_url}, got ${retrieved.document_url}`);
  }
  if (retrieved.driver_portion_monthly !== testPayload.driver_portion_monthly) {
    throw new Error(`Assert failed: driver_portion mismatch. Expected ${testPayload.driver_portion_monthly}, got ${retrieved.driver_portion_monthly}`);
  }
  console.log('[TEST] All assertion checks passed!');

  // 6. Cleanup temporary test data from database
  console.log('[TEST] Cleaning up test data...');
  
  // Delete the VMRentalVehicle record created/updated
  await prisma.vMRentalVehicle.delete({
    where: { vehicle_id: vehicleId }
  });
  console.log('[TEST] Cleaned VMRentalVehicle record.');

  if (isTempVehicleCreated) {
    await prisma.vMVehicle.delete({
      where: { id: vehicleId }
    });
    console.log('[TEST] Cleaned temporary VMVehicle.');
  }

  if (isTempSiteCreated) {
    // Before deleting the site, let's make sure it doesn't violate foreign keys if there are other records.
    // In this case, we deleted the vehicle, so we are safe.
    await prisma.vMSite.delete({
      where: { id: siteId }
    });
    console.log('[TEST] Cleaned temporary VMSite.');
  }

  console.log('[TEST] SUCCESS: All backend running tests passed successfully!');
}

main()
  .catch((err) => {
    console.error('[TEST] ERROR: Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
