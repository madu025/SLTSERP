# Vehicle Management Module - Business Requirements

**Project:** SLTSERP - Vehicle Management System  
**Version:** 1.0  
**Date:** 2026-06-15  
**Status:** Draft

---

## 1. Executive Summary

The Vehicle Management Module is a comprehensive system for managing an organization's fleet, including both **owned vehicles** and **rental vehicles**. The system supports multi-site/office dispatch, driver management with overtime tracking, insurance and warranty management, and integrated payment processing with tax/VAT support.

---

## 2. Business Scope & Context

### 2.1 Vehicle Types Supported
- **Cars** (saloon, compact, sedan)
- **Vans** (cargo, passenger)
- **Mini-vans** (passenger transport)
- **Lorries** (open, covered)
- **Cabs** (single, double)
- **Double-cabs** (crew vehicles)
- **Boom Trucks** (utility, long reach)
- **Trucks** (short-haul, long-haul, refrigerated)

### 2.2 Ownership Models
- **Owned Vehicles**: Assets owned by the organization
- **Rental Vehicles**: Third-party vehicles rented on short/long-term basis
- **Hybrid**: Vehicles with mixed ownership or financing structures

### 2.3 Deployment Scope
- Multi-site/office vehicle allocation
- Driver dispatch from central or site-level
- Real-time vehicle tracking and availability
- Workflow integration with main ERP system

---

## 3. Core Functional Requirements

### 3.1 Vehicle Management

#### 3.1.1 Vehicle CRUD & Classification
- **Store vehicle attributes:**
  - Registration number, chassis number, engine number
  - Make, model, year, color, vehicle type (from list above)
  - Capacity (passengers, cargo weight/volume)
  - Ownership (owned/rental), cost center, assigned site/office
  - Current status (available, in-use, maintenance, decommissioned)
  - Depreciation schedule (for owned vehicles)

- **Support rental contracts:**
  - Rental start/end dates
  - Rental cost (daily/weekly/monthly)
  - Supplier/lessor details
  - Contract terms and conditions

#### 3.1.2 Vehicle Lifecycle
- New vehicle registration
- Vehicle transfer between sites/offices
- Vehicle maintenance scheduling
- Vehicle retirement/disposal
- Audit trail for all changes

### 3.2 Driver Management & Overtime (OT)

#### 3.2.1 Driver Profiles
- Driver basic info (name, ID, contact, address)
- License details (number, expiry, class)
- Certifications (HGV, passenger vehicle, hazmat, etc.)
- Performance metrics (safety score, trips completed)
- Medical fitness status

#### 3.2.2 Driver Overtime Tracking
- **Record work hours:**
  - Daily shift hours
  - Overtime hours (beyond standard 8 hours/day or 40 hours/week)
  - Break tracking (lunch, rest breaks)
  
- **OT Calculation Rules:**
  - Configurable OT threshold (e.g., 8 hrs/day, 40 hrs/week)
  - OT rate multiplier (e.g., 1.5x, 2x regular rate)
  - Weekly/monthly OT limits per regulation
  
- **Reports:**
  - Driver OT summary (daily, weekly, monthly)
  - OT payroll integration export

### 3.3 Insurance & Warranty Management

#### 3.3.1 Vehicle Insurance
- **Store insurance policies:**
  - Policy number, insurer, cover type
  - Premium amount and payment frequency (annual/monthly)
  - Coverage dates (start, renewal, expiry)
  - Coverage limits and excess
  - Insured value
  
- **Track renewals:**
  - Automated alerts before expiry
  - Renewal status (pending, renewed, lapsed)
  
- **Multi-insurance per vehicle:**
  - Primary insurance, additional coverage (theft, accident, etc.)

#### 3.3.2 Vehicle Warranty
- **Warranty tracking:**
  - Warranty period (mileage/time-based)
  - Warranty coverage details
  - Service intervals (oil change, inspection)
  - Warranty claim history

#### 3.3.3 Compliance & Alerts
- Tax compliance (road tax, registration fees)
- Regulatory inspections (MOT, vehicle inspection)
- Alert system for upcoming renewals and compliance deadlines

### 3.4 Site/Office Vehicle Dispatch

#### 3.4.1 Multi-Site Management
- Configure sites/offices with vehicle pools
- Allocate vehicles to sites
- Track vehicle availability per site
- Support inter-site vehicle transfers

#### 3.4.2 Dispatch Workflow
- Assign vehicles to drivers/trips
- View dispatch status and history
- Reassign vehicles in real-time
- Optimize vehicle usage across sites

#### 3.4.3 Availability Management
- Vehicle status (available, in-use, maintenance, reserved)
- Blocking/reserving vehicles
- Maintenance scheduling with vehicle unavailability

### 3.5 Payment & Tax Module

#### 3.5.1 Payment Types
- **Rental payments:**
  - Daily, weekly, monthly rental charges
  - Fuel charges (if applicable)
  - Damage/mileage overage fees
  
- **Service payments:**
  - Maintenance and repair invoices
  - Driver salary/OT payments
  - Insurance premium payments
  
- **Miscellaneous:**
  - Toll/parking fees
  - Registration and license renewals
  - Fines and penalties

#### 3.5.2 Tax & VAT Support
- **Tax configuration:**
  - Configurable tax rates per category
  - Multiple tax types (VAT, GST, sales tax, etc.)
  - Tax-exempt vs. taxable items
  
- **Tax calculation:**
  - Apply tax to invoice line items
  - Support tax-inclusive and tax-exclusive pricing
  - Tax summary on invoices
  
- **Reporting:**
  - Tax collected vs. paid
  - Tax reconciliation reports
  - Export for compliance filing

#### 3.5.3 Invoice & Payment Processing
- Generate invoices with tax breakdown
- Record payments (cash, card, bank transfer)
- Payment reconciliation
- Payment status tracking (pending, partial, completed, overdue)
- Support for credit notes and adjustments

#### 3.5.4 Rental Billing
- Automatic billing based on rental duration
- Daily/weekly/monthly rate switching
- Extra charges (fuel, maintenance, damage)
- Late fees for overdue rentals

### 3.6 Trip & Fuel Management

#### 3.6.1 Trip Tracking
- Record start/end location, driver, vehicle, date/time
- Trip distance and duration
- Fuel consumption
- Trip status (planned, in-progress, completed)

#### 3.6.2 Fuel Logging
- Fuel type (petrol, diesel, electric, hybrid)
- Fuel cost per liter/unit
- Fuel efficiency metrics (km/liter)
- Fuel cost analysis per vehicle/driver

### 3.7 GPS Tracking & Real-time Location

#### 3.7.1 Live Tracking
- Real-time vehicle location on map
- Trip history and playback
- Geofencing (site entry/exit alerts)
- Speed monitoring and alerts

#### 3.7.2 Route Management
- Route optimization and suggestion
- ETA calculation
- Navigation support
- Historical route analysis

### 3.8 Reporting & Notifications

#### 3.8.1 Standard Reports
- Fleet summary (total vehicles, utilization, costs)
- Vehicle performance (trips, fuel, revenue)
- Driver OT and payroll
- Insurance and compliance status
- Payment and financial reports
- Tax reports (tax collected, VAT summary)

#### 3.8.2 Export Formats
- PDF, Excel (CSV)
- Monthly/quarterly summary reports
- Filtered reports (by date, site, vehicle, driver)

#### 3.8.3 Notifications
- Email/SMS alerts for:
  - Insurance/warranty expiry
  - Compliance deadlines
  - Vehicle maintenance due
  - OT limit breaches
  - Payment overdue
  - Fuel price alerts

### 3.9 Workflow Integration

#### 3.9.1 Event Triggers
- Vehicle assigned/unassigned
- Trip completed
- Driver OT exceeds limit
- Insurance expires
- Payment received/overdue
- Maintenance scheduled

#### 3.9.2 ERP Integration
- Publish vehicle events to main workflow engine
- Receive approval workflows (e.g., for rental authorization)
- Sync with accounting module for payments

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Sub-second response for vehicle list/search
- Real-time GPS tracking with <5 second latency
- Support for 1000+ vehicles and 10,000+ trips per month

### 4.2 Security
- Role-based access control (RBAC)
  - Fleet Manager: Full access
  - Driver: View own profile, trips, assign vehicle
  - Site Admin: Manage site vehicles, local dispatch
  - Finance: Payment and tax reports
  - Compliance Officer: Insurance and warranty tracking
- Encrypt sensitive data (driver license, insurance details)
- Audit logging for all transactions

### 4.3 Scalability
- Multi-site support without performance degradation
- Modular architecture for future extensions
- Support for third-party integrations (GPS provider, payment gateway)

### 4.4 Reliability
- 99.5% uptime SLA
- Automatic backup of trip and payment data
- Recovery procedures for data loss

---

## 5. Technical Architecture

### 5.1 Technology Stack
- **Backend:** Node.js/TypeScript with Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Frontend:** React with Next.js or similar
- **Mobile:** React Native or Flutter
- **GPS/Maps:** Google Maps API or OpenStreetMap
- **Payment Gateway:** Stripe / Razorpay (pluggable)
- **Authentication:** JWT with OAuth2 support

### 5.2 Database Entities (Core)
- Vehicle, VehicleType, RentalVehicle, OwnedVehicle
- Driver, DriverOT, DriverLicense, Certification
- Trip, TripStop, Fuel Log
- Insurance, InsurancePolicy, Warranty
- Payment, Invoice, PaymentTransaction, PaymentTax, TaxConfig
- Site, Office, SiteVehicleAllocation
- DispatchOrder, VehicleAssignment
- GPSLocation, Geofence

### 5.3 API Design
- RESTful API with OpenAPI/Swagger documentation
- Versioning support (v1, v2, etc.)
- Event-driven architecture for real-time updates (WebSocket)
- Webhook support for ERP integration

---

## 6. MVP Feature Set (Phase 1)

### Priority 1 (Must-Have)
1. Vehicle CRUD + classification by type
2. Driver management + OT tracking
3. Basic trip logging
4. Vehicle dispatch/allocation
5. Payment & invoice module with tax support
6. Insurance expiry tracking
7. Basic reporting (fleet summary, OT)

### Priority 2 (Should-Have)
1. GPS real-time tracking
2. Rental vehicle management
3. Fuel cost analysis
4. Multi-site dispatch
5. Advanced reporting (PDF export, email)

### Priority 3 (Nice-to-Have)
1. Mobile app for drivers
2. Route optimization
3. Advanced geofencing and alerts
4. Predictive maintenance
5. Third-party integration (payment gateways, GPS providers)

---

## 7. Success Criteria

- [ ] All MVP features functional and tested
- [ ] 90% test coverage for payment and tax modules
- [ ] Performance benchmarks met (response time <1s for fleet list)
- [ ] Security audit passed (OWASP compliance)
- [ ] User acceptance testing completed
- [ ] Documentation and training materials completed

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| GPS provider downtime | Loss of tracking | Use fallback provider, cache last-known location |
| Payment gateway failure | Revenue impact | Implement retry logic, queue payments offline |
| Database performance | System slowdown | Indexing strategy, partitioning for large tables |
| Data security breach | Compliance violation | Encryption, regular security audits, backup strategy |

---

## 9. Appendix: Detailed Domain Models

### Vehicle
- ID, registration_number, chassis_number, engine_number
- make, model, year, color, vehicle_type (enum)
- capacity_passengers, capacity_cargo_weight, capacity_cargo_volume
- ownership (owned/rental), status (available/in-use/maintenance/decommissioned)
- assigned_site_id, current_location (lat/lng)
- purchase_date, purchase_cost, depreciation_schedule
- created_at, updated_at

### Driver
- ID, name, contact, address, email, phone
- license_number, license_expiry, license_class
- performance_score, medical_fitness_status
- certifications (HGV, passenger, hazmat)
- created_at, updated_at

### Trip
- ID, driver_id, vehicle_id, start_location, end_location
- trip_date, start_time, end_time, duration
- distance, status (planned/in-progress/completed)
- fuel_consumed, fuel_cost
- created_at, updated_at

### Payment
- ID, amount, tax_amount, total (amount + tax)
- payment_type (rental/maintenance/insurance/fuel/ot_salary)
- reference_id (rental_id/invoice_id), tax_config_id
- status (pending/partial/completed/overdue)
- payment_date, created_at, updated_at

### Insurance
- ID, vehicle_id, policy_number, insurer_name
- cover_type, premium, premium_frequency (annual/monthly)
- start_date, renewal_date, expiry_date
- coverage_limit, excess, insured_value
- status (active/pending_renewal/expired)
- created_at, updated_at

---

**Document Approved By:** [To be signed off]  
**Next Review Date:** 2026-07-15

