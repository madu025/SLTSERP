# CPE serials from the SLT CPE Locator: plan for the SOD module

Status: plan, not built. Written 28 Nov 2026 from the owner's answers (two rounds, same day). Nothing here changes production until the owner approves the
migration (rule 4 of `docs/ai-handover.md`).

## 1. What SLT is changing

SLT will run a system called **CPE Locator**. SLT gives each contractor CPE devices (ONT, STB, phone) with known serial numbers, and an
order (SOD) can be completed or upgraded **only with a serial that SLT issued**. Every serial belongs to one RTOM and never moves to another
area. Nexus must be ready before SLT switches it on: today an ONT serial is free text and nothing checks it.

## 2. Owner decisions (28 Nov 2026)

| Question | Answer |
|---|---|
| How does CPE Locator data reach us (Excel, API, sample file)? | Not known yet; no sample. Build an upload with a downloadable template and column matching, plus scan or type one by one. Keep an import interface that an API can call later. |
| Does a serial reach the contractor directly or through our store? | **Both.** Small quantities: SLT hands them straight to the contractor. Larger quantities: a bundle comes to our store, then goes to the contractor on an issue note (MIN). |
| Server rules | Agreed: the serial must be in the register, belong to the order's RTOM, be held by the order's contractor, and not be installed elsewhere; otherwise completion/upgrade is refused with the reason. No route changes a serial's RTOM; if ever needed, administrators only, with an audit entry. |
| Who scans? | Office staff, for now (contractor app later). |
| Which orders need a serial? | **Every order.** A serial that was used before is valid only when SLT issued it again: the old customer stopped using it, or it was installed, became faulty, was replaced, repaired and issued again. |
| Upgrade: may the customer keep the device already installed ("Existing / Re-use")? | **Mostly yes.** An upgrade usually keeps the customer's existing device and its serial. A new device (new SLT-issued serial) is also possible when the old one is faulty or for another reason. |
| Must a second person approve a direct issue to a contractor? | **No.** For small quantities the SLTS **Area Coordinator or QC Officer** of the RTOM enters (types or scans) the serials; no approval. |
| CPE item codes? | **None exist.** Create generic CPE items (section 8); the model is kept on each serial. |
| Which store belongs to each RTOM? | The **administrator sets it later** (Inventory / Stores, store form, field linking the store to its RTOMs - `opmcIds` - already exists). |
| Faulty devices back to SLT | A **Collected CPE report** is sent to SLT for faulty CPE and for the old devices taken from customers on upgrades: it lists the serials together with the devices collected. |
| SLT export / API | Not available now; may come later. Start with our template; add SLT's columns when a file arrives. |

## 3. What exists today (checked 28 Nov 2026)

- `ServiceOrder.ontSerialNumber` (free text) and `SODIptvSerial` (STB, `serialNumber` unique) are written by Confirm Completion
  (`src/components/modals/order-action/DeviceSerialSection.tsx`, `sod.lifecycle.service.ts`). Nothing validates them. Production: 3,813 orders
  with an ONT serial, 346 STB serials.
- `InventoryItemSerial` (one row per serial: `status`, `storeId`, `contractorId`, `sodId`, `locator`) is the serial register. Production: **0 rows**,
  and **no item has `hasSerial = true`**. `IssueService.issueMaterial` already moves serials IN_STORE -> ISSUED on a MIN, and
  `SODMaterialService.processMaterialUsage` already checks a serial on a material line (`SERIAL_NOT_FOUND`, `SERIAL_ITEM_MISMATCH`,
  `SERIAL_NOT_AVAILABLE`) and sets it INSTALLED (or FAULTY on wastage). The register has **no RTOM** and no history.
- `CollectedCPE` records a device taken back from a customer (`condition`, `PENDING_HANDBACK`, `handbackReference`). Production: 0 rows.
- `SODSltReportedMaterial.serialNumber` holds the serials SLT reports for an order (portal sync/extension): usable to cross-check.
- Only 3 of 44 OPMCs have a store linked (`OPMC.storeId`), and one of them is a closed ZZ test area. The store path (section 5B) needs each
  RTOM's store first.
- No barcode or QR library is installed.

## 4. Concepts

**CPE serial** = one physical device, one row in `InventoryItemSerial`, keyed by the serial number (unique, normalised: trimmed, upper case, no
spaces). It always has an **RTOM** (`opmcId`) set when it enters the register; the RTOM never changes in normal use.

**Holder and status** (current state, on the row):

| Status | Holder | Meaning |
|---|---|---|
| `IN_STORE` | store | Received in a bundle, in our store of that RTOM |
| `ISSUED` | contractor | With the contractor (from a MIN, or handed over directly by SLT) |
| `INSTALLED` | order (`sodId`) | Installed at a customer on a completed/upgraded order |
| `RECOVERED` | contractor or store | Taken back from a customer (stopped using, replaced) - a `CollectedCPE` row |
| `FAULTY` | contractor or store | Found faulty (at installation or after) |
| `RETURNED_TO_SLT` | SLT | Handed back to SLT with SLT's reference |

**Issue cycle.** A serial can live several lives. Each time SLT issues it (first time, or again after recovery/repair) a new **cycle** starts
(`issueCycle` 1, 2, 3...). Within one cycle it can be installed **once**. A serial that is `INSTALLED`, `RECOVERED`, `FAULTY` or
`RETURNED_TO_SLT` cannot be used on an order until SLT issues it again (an import or receipt that names it), which opens the next cycle.

**Serial history** = new append-only table `CpeSerialEvent` (who, when, from -> to status, holder, order, document number such as
MIN/CPR/MRN, SLT reference, reason) with a SHA-256 checksum chained like `InventoryLedger` (AGENTS.md: immutable audit ledger). The row in
`InventoryItemSerial` is only the current state; the events are the evidence.

## 5. How serials enter Nexus

Both paths produce a numbered document, `CpeSerialEvent` rows, and stock/ledger entries, because every custody move needs an issue note
number and an `InventoryLedger` entry (AGENTS.md).

**A. Small quantity, SLT hands it to the contractor directly**
Service Orders -> CPE Serials -> **Record SLT issue to contractor**, done by the **Area Coordinator or QC Officer** of that RTOM (no approval): pick
RTOM (only their own), contractor, CPE type, SLT reference/date; scan, type or upload the serials. One transaction writes a CPE Receipt `CPR-YYYY-MM-NNNN` into the RTOM's store and an immediate MIN to the contractor, so the
store ledger, contractor stock and FIFO batch stay consistent with every other movement. Serials end `ISSUED` to that contractor.

**B. Bundle to our store**
**Receive CPE bundle**: pick RTOM (its store), CPE type, SLT reference; upload or scan. Creates `CPR-...`, stock in, serials `IN_STORE`.
The store then issues them on the normal MIN screen, where the serials are scanned (the MIN already validates serials).

**Upload format.** Download a template (`Serial number`, `CPE type`, `Model`, `SLT reference`, optional `Contractor`). The upload shows a
preview: valid rows, duplicates in the file, serials already in Nexus (with status, RTOM, holder), a different RTOM, unknown type. Nothing is
saved until the user confirms. When SLT shares a real export, add its column names as aliases. No second-person approval for direct issues (A,
owner); a bundle (B) is received by the stores staff in one step, like a GRN acceptance (owner may ask for an approval later).

**Re-issue by SLT.** A serial already in Nexus can be accepted again only when: it is in the **same RTOM**; its status is `RECOVERED`, `FAULTY`
(repaired) or `RETURNED_TO_SLT`; and the user confirms "Issued again by SLT" (reason kept). Then `issueCycle` + 1. A serial that is still
`INSTALLED` on an active order is shown as a conflict: the user must first record the recovery on that order (who, why), then the re-issue.
A serial in another RTOM is refused.

## 6. Entering a serial: scan or type

One shared component, `CpeSerialInput`, used on Confirm Completion (ONT, STB rows, phone), the MIN, the receipt screens and returns:

- **Manual**: type; normalised on blur.
- **USB/Bluetooth barcode scanner**: these type like a keyboard and end with Enter. Fast keystrokes ending with Enter are taken as one scan and
  validated at once; focus moves to the next serial field.
- **Phone or laptop camera**: a camera button opens a scanner for QR and 1D barcodes (Code 128 etc.). Library preflight at build time:
  `@zxing/browser` (open source), using the browser's native `BarcodeDetector` where available; `html5-qrcode` is the alternative. Camera needs
  HTTPS (production is) or localhost.
- After each entry an **instant check** (`GET /api/cpe-serials/check?serial=&serviceOrderId=`) shows green "Issued to <contractor>, <RTOM>" or red
  with the reason, before saving. Duplicates inside the same form are refused at once.

## 7. Rules when an order is completed or upgraded (server, cannot be bypassed)

New pure rules in `src/lib/cpe-serial-rules.ts` (unit tested), applied in `sod.lifecycle.service.ts` / `SODMaterialService` inside the completion
transaction with a row lock on each serial:

| Check | Refusal code (message shown) |
|---|---|
| Serial is in the register | `CPE_SERIAL_NOT_FOUND` - "This serial was not issued by SLT (not in the CPE register)" |
| Serial's RTOM = order's RTOM | `CPE_SERIAL_WRONG_RTOM` - "Serial belongs to R-XX" |
| Status `ISSUED` and holder = order's contractor | `CPE_SERIAL_NOT_WITH_CONTRACTOR` - shows the real holder |
| Not installed in this cycle on another order | `CPE_SERIAL_ALREADY_INSTALLED` - shows that order number |
| CPE type fits the field (ONT serial in ONT field) | `CPE_SERIAL_WRONG_TYPE` |
| Every order has its required serial(s) (ONT; STB per IPTV count) | `CPE_SERIAL_REQUIRED` |

**Upgrade keeping the existing device ("Existing / Re-use", owner: the usual case).** The serial need not be newly issued. It is accepted when
it is the serial **already installed for the same customer**: the register shows it `INSTALLED` on an earlier order with the same voice number
(or customer account) in the same RTOM, or - for devices installed before the register existed - an earlier order of that voice number carries
the same serial in `ontSerialNumber` / `SODIptvSerial`. Then the serial moves to the upgrade order (event `REUSED_ON_UPGRADE`, same cycle, no
contractor stock change). Any other serial on "Existing / Re-use" is refused (`CPE_SERIAL_NOT_AT_CUSTOMER`). When the upgrade installs a **new**
device instead (old one faulty or another reason), the new serial passes the normal rules and the old device is recorded as collected
(below).

On success: status `INSTALLED`, `sodId` set, event written, contractor stock -1. Editing a completed order releases the old serial
(back to `ISSUED`) and installs the new one, both as events.
**Order returned or disappeared (RETURN / DISAPPEARED rollback):** the serial goes back to the contractor (`ISSUED`), same cycle - matches the
material rule already in `SODMaterialService.rollbackMaterialUsage`. **HO PAT rejection:** the serial stays installed (same rule as material).

**Faulty replacement and old devices from upgrades:** on the order the old device is recorded in the replaced-device rows (serial, type,
condition Faulty or Working) -> `CollectedCPE` + event `RECOVERED`/`FAULTY`; the new serial passes the rules above.

**Collected CPE report to SLT (owner).** Inventory / Stores (or Service Orders) -> **Collected CPE**: per RTOM and period, every collected device
waiting for handback - serial, device type and model, condition, order number, voice number, contractor, collected date. Export to Excel/PDF
in the layout SLT accepts, then **Mark as sent** with the report reference: one transaction sets `CollectedCPE` `HANDED_BACK`
(`CPEService.submitHandback` already does this part) and the serials `RETURNED_TO_SLT` with events. Later SLT can repair and issue them again
(next cycle, section 5).

**Switch (per RTOM)**, system config `CPE_SERIAL_ENFORCEMENT`: `OFF` -> `WARN` (default after go-live: save allowed, warning stored on the
order, listed on a report) -> `ENFORCE` (refused). An RTOM moves to ENFORCE when SLT starts CPE Locator there and its serials are loaded, so
work never stops while the register is being filled.

## 8. Data model (one additive migration, owner approval before push)

- `InventoryItemSerial`: add `opmcId` (RTOM), `cpeType` (ONT/STB/PHONE/OTHER), `model`, `source` (SLT_CPE_LOCATOR/MANUAL/IMPORT),
  `sltReference`, `receivedAt`, `issueCycle` (default 1), `lastEventAt`; indexes on `opmcId`, (`opmcId`,`status`).
- New `CpeSerialEvent` (append-only, checksum chain, no update/delete in code; a DB trigger refusing UPDATE/DELETE like the ledger if one exists).
- New `CpeReceipt` + `CpeReceiptLine` (`CPR-YYYY-MM-NNNN`, RTOM, store, SLT reference, mode DIRECT_TO_CONTRACTOR/TO_STORE, status, maker, approver).
- CPE items in the item master with `hasSerial = true`. No codes exist (owner), so create three generic items: `CPE-ONT` (ONT / router),
  `CPE-STB` (IPTV set-top box), `CPE-PHONE` (voice instrument), unit Nos, cost 0 (SLT-owned devices). The model is a text field on each serial.
  The codes can be renamed in the item master later.
- Existing free-text serials (3,813 ONT, 346 STB) stay as history; they are **not** loaded into the register (they were never issued through
  Nexus). A report can match them against the register later.

## 9. Permissions and scope (follow `docs/authorization-architecture.md`)

New capabilities in `src/config/rbac-permissions.ts`, with seed, admin UI, guards and tests together:
`inventory.cpe.receive` (record receipts / direct issues; granted to Area Coordinator, QC Officer and the stores roles), `inventory.cpe.approve` (approve a bundle, never the maker),
`inventory.cpe.read` (register and history), `inventory.cpe.admin` (the audited RTOM correction and enforcement switch; administrators only).
Completion keeps `sod.write`. Every read/write is limited to the user's RTOMs (`resolveOpmcScope`).

## 10. Screens

1. Inventory / Stores -> **CPE Serials**: register by RTOM, status, contractor, type, cycle; search by serial (scan box); a serial's page shows its
   full history (events, orders, documents).
2. **Record SLT issue to contractor** (Service Orders menu, for the Area Coordinator and QC Officer) and **Receive CPE bundle** (Inventory /
   Stores, for the stores staff), with upload preview (section 5).
3. Confirm Completion: ONT/STB/phone fields become `CpeSerialInput` with scan and instant check.
4. MIN and returns: serial scan for CPE items.
5. **Collected CPE** report for SLT (faulty devices and old devices from upgrades), export, Mark as sent with reference.
6. Reports: serials issued but not installed (by contractor, age), WARN-mode orders with an unregistered serial, faulty pending handback,
   SLT-reported serial vs entered serial mismatches.
7. Contractor app (later phase): the contractor sees the serials they hold.

## 11. Phases

1. **Register and entry** (no enforcement): migration, CPE items, receipts A and B, upload, `CpeSerialInput` with scanner/camera, instant check,
   register and history screens, switch at `OFF`/`WARN`. Guide `cpe-serials` on Help; SOD guide updated.
2. **Rules**: completion/upgrade/edit/rollback rules, upgrade re-use of the customer's device, faulty replacement, Collected CPE report and
   handback, re-issue cycle; `ENFORCE` per RTOM once its store is linked and its serials are loaded.
3. **Later**: contractor app scanning, SLT API import if SLT offers one, compliance audit check for the serial event chain and serials
   installed twice in one cycle.

## 12. Tests

Unit: `tests/unit/cpe-serial-rules.test.ts` (every refusal code, cycles, re-issue, RTOM). Service script `scripts/zz-cpe-serial.ts` in one rolled-back
transaction (receipt -> MIN -> complete -> wrong RTOM refused -> return rollback -> faulty -> handback -> re-issue cycle 2 -> install again).
Browser QA on localhost with a USB-scanner simulation (typed text + Enter) and the camera dialog. RBAC, page-API, guides and contrast checks.

## 13. Open questions for the owner

Answered on 28 Nov (see section 2). Still to settle when building:

1. Upgrade re-use: is the voice number enough to say "same customer", or does SLT use another customer key (account number) that the portal
   sync already gives us?
2. The exact layout SLT wants for the Collected CPE report (a sample of the report sent today would let the export match it).
3. Prerequisite before the store path (B) and before ENFORCE: the administrator links each RTOM to its store (only 3 of 44 linked today).
