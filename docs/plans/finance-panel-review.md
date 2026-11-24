# OSP Finance section: business model, panel review and implementation order

Written 2026-11-24. Method: ten people who really work in or around the OSP finance section each ask six questions; every question is answered from the code as it is today. Status: OK = works today, PART = works in part or not verified in the browser, GAP = missing, DECIDE = needs the owner's decision.
No names, amounts or bank data from the working files are used here.

## 1. How the business works (the model the system must follow)

1. **OSP is a division that does not own a bank account of its own for its payments.** Head Office (HO) holds the bank. OSP raises payments; HO pays. OSP keeps a *current account with HO* that is reconciled every month against HO's own statement.
2. **Money reaches OSP in three ways**: (a) HO pays a payment request that OSP raised and approved (contractors, vendors, rent, vehicles, project advances); (b) HO funds a *petty cash float* and tops it up when bills are reimbursed; (c) OSP bills SLT for work and collects the receipts.
3. **Small spend is done with cash** kept at each site office: a petty cash float and a project advance float. A person is given an *IOU* (cash advance) against a float, spends it, hands in bills and returns what is left. The bills are claimed from HO as a *reimbursement*, which refills the float.
4. **Every payment goes through three checks inside OSP before HO sees it**: Finance Manager, OSP Manager, Head of Section. HO then moves it through its own stages (received, pending, signature, paid) and records the payment with a reference, date and amount, in parts if needed.
5. **Control principles** (already in the system and to be kept): maker is never checker; approval limits; immutable ledger and settlement rows; data scope by site office; every status change audited.

```
SLT (client) --invoice--> OSP --collect--> receipts (AR)
OSP payment request --[Finance Mgr -> OSP Mgr -> Head of Section]--> HO pack --[HO stages]--> HO pays (reference, date, amount, parts)
HO funding --float / top-up--> site office petty cash --IOU--> person --bills + refund--> settlement --reimbursement claim--> HO funding
```

## 2. The panel: 10 people, 60 questions

### A. OSP Finance Manager
| # | Question | Today | Status |
|---|---|---|---|
| 1 | One screen of everything waiting for my approval (vouchers, IOUs, advances, rents, funding)? | Vouchers on the payments page, IOUs on their own page; no combined queue | GAP |
| 2 | Is a payment above my limit stopped? | Approval limits apply to payment vouchers; not to IOUs, advances, rent, fuel, hiring | PART |
| 3 | Who approves when I am on leave? | Only the CEO holds `finance.approve` apart from the Stores Manager | GAP |
| 4 | What did HO pay and what is pending for each pack? | Pack status (submitted, part paid, paid, returned) | PART (no HO stages) |
| 5 | Can I reconcile the HO current account each month? | Month-end reconciliation exists | OK |
| 6 | Cash and float of every site office at a glance? | IOU floats list (new); petty cash accounts only by API | PART |

### B. Finance Assistant
| # | Question | Today | Status |
|---|---|---|---|
| 7 | Raise a payment request for an approved contractor invoice | HO run creates the requests | OK |
| 8 | Attach the invoice, PO and receipt to a request | The pack shows invoice, PO and GRN numbers; file attachments on the request not verified | PART |
| 9 | Correct a request that was sent back | HO returns it to the approved queue with a reason; a rejected request must be made again | PART |
| 10 | Is a double payment of the same invoice blocked? | Live requests are summed against the invoice before a new one | OK |
| 11 | Load the existing registers (project advances, IOUs, rents) | No import for them | GAP |
| 12 | Withholding tax on rent and vehicle payments | Default per payment category, editable per request | OK |

### C. Cashier
| # | Question | Today | Status |
|---|---|---|---|
| 13 | Hand cash to a person against an IOU and have them acknowledge it | IOU is recorded (new); no acknowledgement by the receiver | GAP |
| 14 | End-of-day count against the system balance | No cash-in-hand figure, no count | GAP |
| 15 | Take bills and refunds back | IOU settlement (new); petty cash vouchers only by API | PART |
| 16 | Cancel a voucher with a reason and point to the voucher it moved to | Reject has a reason; no cancel register | GAP |
| 17 | Chase overdue IOUs | Days open, reminder notes (new); no automatic notice | PART |
| 18 | Does the Cashier mark anything as paid? | No: paid is HO's record | DECIDE (settled: no) |

### D. AR Officer
| # | Question | Today | Status |
|---|---|---|---|
| 19 | Receivable aging of SLT invoices | AR aging page exists | OK |
| 20 | Record a receipt against an invoice | The receipts route needs `finance.approve`; the AR Officer only reads | GAP (role) |
| 21 | Follow-up notes on overdue invoices | Invoice status FOLLOW_UP exists; notes not verified | PART |
| 22 | Credit notes | Route needs `finance.approve` | PART |
| 23 | Collections report for management | Page exists | OK |
| 24 | Retention due dates | Retention page exists | OK |

### E. OSP Manager
| # | Question | Today | Status |
|---|---|---|---|
| 25 | Approve a payment before it goes to HO | Not in the payment flow (only the Finance Manager) | GAP |
| 26 | See finance data of every area | `scope.finance.all` | OK |
| 27 | Stay out of SOD detail | Finance roles do not hold SOD scope | OK |
| 28 | Be told when something waits for me | No notification for payments | GAP |
| 29 | Hand over approval when away | No delegation | GAP |
| 30 | See what HO owes OSP and the funding position | Funding position panel | OK |

### F. Head of Section
| # | Question | Today | Status |
|---|---|---|---|
| 31 | Approve every payment, or only above an amount? | Not defined | DECIDE |
| 32 | Payments by project | Project finance dashboard | OK |
| 33 | Reject with a reason: back to which step? | Not defined | DECIDE |
| 34 | Approve many at once | Not available | GAP |
| 35 | Approve on a phone | Not tested | PART |
| 36 | Who approved what and when | Approver ids and audit log on vouchers and (new) OSP items | OK |

### G. HO Finance Officer
| # | Question | Today | Status |
|---|---|---|---|
| 37 | A list of what to pay, with the evidence | The pack | PART (no HO officer role) |
| 38 | Pay part now, the rest later | A voucher is paid whole; part means a second voucher | GAP |
| 39 | Record reference, date and amount | Reference and date only | PART |
| 40 | Mark "pending, no funds" | Not possible | GAP |
| 41 | Send back with a reason | Return to OSP with a reason exists | OK |
| 42 | See only HO work, not the OSP books | No HO scope | GAP |

### H. HO Finance Manager
| # | Question | Today | Status |
|---|---|---|---|
| 43 | A proceed list of pending items | None | GAP |
| 44 | A signature stage | None | GAP |
| 45 | Approve and fund the petty cash float and top-ups | Funding approve and fund exist | OK |
| 46 | Compare the OSP account with HO's statement | Reconciliation exists | OK |
| 47 | How long has each item waited at HO | Not shown | GAP |
| 48 | Change the status list myself | Not possible (to be an Admin table) | GAP |

### I. Site office staff (IOU holder, Area Manager)
| # | Question | Today | Status |
|---|---|---|---|
| 49 | Ask for an IOU myself | Only the finance people record it | DECIDE |
| 50 | See my open IOUs and how long they have been open | Needs `finance.read`; no "my IOUs" view | GAP |
| 51 | Hand in bills with a photo | IOU settlement has a reference only; the petty cash voucher has a receipt link | GAP |
| 52 | A reminder before my IOU is overdue | None | GAP |
| 53 | What if I never settle: recovery from salary | Not built; needs an accountant's account | DECIDE |
| 54 | Link a project advance to the project it is for | `OspProjectAdvance` has no project | GAP |

### J. Auditor (SF Audit, internal audit, CEO)
| # | Question | Today | Status |
|---|---|---|---|
| 55 | Test a sample of bills against vouchers | Receipt link only; no bill file kept | PART |
| 56 | Can any trail be changed afterwards | Ledger and settlement rows are immutable | OK |
| 57 | Payee is not the registered owner, or is staff or a relative | No check | GAP |
| 58 | Maker equals checker breaches | SOD breach report exists; OSP items not yet in it | PART |
| 59 | Is a closed month locked | Period close and fiscal lock exist | OK |
| 60 | Vehicle and asset verification against documents | Registers exist; no verification workflow | PART |

Result: 60 questions: **OK 17, PART 15, GAP 23, DECIDE 5** (DECIDE: 18, 31, 33, 49, 53).

## 3. Gap register (grouped, with the decision to take)

| Group | Gaps (question numbers) | Phase |
|---|---|---|
| Payment approval chain and HO flow | 3, 25, 28, 29, 31, 33, 34, 37 to 44, 47, 48, 4 | B |
| Petty cash one model, cash in hand, bills | 6, 13 to 17, 50 to 52, 55 | A |
| Approvals queue, deputy, "my IOUs" for staff | 1, 2, 3, 49, 50, 52 | C |
| Registers and links (advance to project, rent, fuel, hiring) | 11, 54, 57 | D |
| Receipts and AR roles | 20, 22 | C |
| Audit controls | 57, 58, 60 | E |

Decisions: 18 (the Cashier marks nothing as paid), 31, 33 and 53 are settled (section 3a); only 49 (do site staff ask for IOUs themselves) stays open and keeps its default: only the finance people record IOUs.

## 3a. Owner's decisions on the open questions (2026-11-24)

| # | Decision |
|---|---|
| 31 | The OSP Manager and the Head of Section approve **every** payment (after the Finance Manager). |
| 33 | An approver who does not approve either **holds** the request or **rejects** it. *Hold*: it goes back to the person who raised it, who reviews it and sends it again. *Reject*: a reason is required and the request is closed. |
| 53 | No recovery from salary for now. An IOU that is not settled raises a **salary hold request**: a message to the roles that handle salary. When the IOU is settled the hold lifts by itself. |
| 49 | Not answered: stays as it is (only the finance people record IOUs). |

### Payment approval states (decision 33, thought through)
`DRAFT -> PENDING_APPROVAL (step 1 Finance Manager -> step 2 OSP Manager -> step 3 Head of Section) -> APPROVED -> submitted to HO -> HO stages -> PAID`
- **ON_HOLD**: any approver at their step may hold, with a note. The request returns to its maker; the approvals given so far are kept in the history but no longer count.
- The maker reviews, edits and **sends it again**; the chain starts again from step 1 (the contents may have changed, so every step must see the new version). The same person cannot approve two steps.
- **REJECTED**: any approver may reject, with a required reason; it is closed for good. The maker, if the payment is still owed, raises a new request.
- A request on hold longer than a number of days (set by the Admin) is shown to its maker and to the Finance Manager as stale.
- Every hold, resend and rejection is a row in the history with who, when and why.

### Salary hold for an unsettled IOU (decision 53, thought through)
Nothing is deducted: the system only **raises, shows and lifts a hold request**.
1. **Overdue**: an issued IOU with an outstanding amount and more days open than its float allows (default 30) is flagged overdue. The holder, the Cashier and the Finance Manager are told.
2. **Request**: the Finance Manager presses *Request salary hold* (a float setting may also raise it automatically some days after the overdue date; 0 = manual only). The request keeps the outstanding amount, the reason and who asked.
3. **Who is told**: everyone who holds the new capability `finance.salary-hold.read` (the owner picks the roles on the permissions screen; default the Finance Manager, the Finance Assistant, the Cashier and the Office Admin) gets a message "hold Rs. X of <person> until IOU <no> is settled" and sees a *Salary hold* list. The person concerned sees a notice on their own IOU.
4. **Acknowledge**: a person who processes salary marks the hold as *applied*; this is only a record.
5. **Lift by itself**: every settlement updates the amount on hold; when the outstanding amount reaches zero the hold is released at once and the same people get "release the hold of <person>". No one has to remember.
6. **Other ways out**: the Finance Manager may extend the days once with a reason, or cancel the hold with a reason; an IOU that is rejected or cancelled never raises one.
7. **Link to a user**: an IOU is recorded with a free-text name today. An optional link to a system user is added so the person gets the messages and can see "my IOUs"; without a link the message goes to the finance roles only.
8. **History** of the hold (requested, applied, amount changed, released, cancelled) is kept as immutable rows.
9. **Policy**: holding pay can be disputed without a written company rule or the person's consent. HR or legal should confirm the rule and the wording before the first hold is used. The system keeps the rule text in one place (a setting), so it can be shown on the notice.

## 4. Target design

**Petty cash is one model.** The cash box of a site office is the `PettyCashAccount` (imprest limit, balance); IOUs are issued against it (the `OspFloat` becomes the IOU limit view of the same box, not a second box).
- Cash in hand = imprest balance less cash out on open IOUs. Bills approved but not reimbursed are already out of the balance.
- A settlement of an IOU with bills creates an approved petty cash voucher linked to the IOU (one source for bills); a refund returns cash to the box.
- Replenishment: the approved, unreimbursed vouchers go in one claim; HO funds it in full; the box is refilled up to the limit.
- Float changes: an increase is a funding request; a decrease returns cash to HO and is recorded (a new "float return").
- A cancelled voucher keeps its reason and the number it was carried to; the claim is printed in the current layout, analysed by GL account.

**Payments to HO.** `PAYMENT_VOUCHER` process gate (Finance Manager, OSP Manager, Head of Section; the Admin edits steps). HO stages in a database table the Admin edits; installments (reference, date, amount) per payment; the voucher is paid when the installments reach the net amount. HO Finance Officer and HO Finance Manager roles with HO-only scope. Notifications: contractor payment emails the contractor; a project payment tells the Project Manager with the details.

**Controls kept everywhere**: maker is not checker, approval limit, immutable rows, scope by site office, audit log.

## 5. Implementation order

| Phase | What | Test |
|---|---|---|
| 0 (done) | Maker is not checker on OSP items; GL fallback accounts; IOU float, settlement and page; dashboard fix | 22 service checks, GUI test with three roles |
| A | Petty cash one model: account page, bills (vouchers) with settlement link, cash in hand, replenishment request, float return, cancel register, claim by GL account | Service test with real roles, then browser |
| B | Payment chain gate, HO stages table, installments, HO roles and scope, notifications | Lifecycle test with real roles, then browser |
| C | Finance approvals queue, deputy role, "my IOUs" for staff with reminders, AR receipts for the AR Officer | Browser |
| D | Registers: project advance with project and HO dates, rent period and paid status, fuel top-ups, hiring link; import of the existing registers | Import dry run in a real transaction |
| E | Audit controls: payee against registered owner, staff or relative flag, OSP items in the breach report | Service test |

Each phase ends with: type, unit, RBAC checks, the system guide for Finance, the authorization document, a service-level test with real roles, a browser test with the relevant roles, and a push.
