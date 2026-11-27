import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import type { ModuleGuide } from './types';

const CREATE = 'src/app/inventory/requests/create/page.tsx';
const REQUESTS = 'src/app/inventory/requests/page.tsx';
const APPROVALS = 'src/app/procurement/approvals/page.tsx';
const ORDERS = 'src/app/procurement/orders/page.tsx';
const GRN = 'src/app/inventory/grn/page.tsx';
const HO = 'src/app/finance/ho-payments/page.tsx';
const CHAIN = 'src/app/procurement/payment-approvals/page.tsx';
const STATUS = 'src/app/procurement/vendor-payments/page.tsx';
const GATES = 'src/lib/purchase-flow-gates.ts';
const GRN_RULES = 'src/services/inventory/grn.service.ts';
const HO_SERVICE = 'src/services/procurement/ho-payment.service.ts';
const DIGEST = 'src/lib/ho-payment-digest.ts';

export const PURCHASE_GUIDE: ModuleGuide = {
    id: 'purchase',
    title: 'Purchase flow: material request to HO payment',
    purpose:
        'How material is bought from a local vendor, from the Stores Officer\'s request to the payment Head Office (HO) makes to the vendor. '
        + 'Each step is done by one person and then waits for the next one, who gets a notice. Every form lists its checks under '
        + '"Before you confirm"; the button stays locked until all of them pass, and the server applies the same checks.',
    watch: [
        CREATE, REQUESTS, APPROVALS, ORDERS, GRN, HO, CHAIN, STATUS,
        GATES, 'src/lib/grn-gate.ts', DIGEST,
        'src/components/purchase',
        'src/services/inventory/stock-request.service.ts',
        GRN_RULES,
        'src/services/procurement/purchase-order.service.ts',
        'src/services/finance/payment-voucher.service.ts',
        'src/services/finance/pv-chain.service.ts',
        HO_SERVICE,
    ],
    glossary: [
        { term: 'Material request (PRN)', meaning: 'The Stores Officer\'s request for items to be bought. Its number starts with PRN.' },
        { term: 'PO', meaning: 'Purchase order. It is approved in the HO system first; Procurement then records it in Nexus with the HO-approved price.' },
        { term: 'GRN', meaning: 'Goods received note: what the store received against a PO, with the vendor invoice and the Oracle GRN number.' },
        { term: 'Payment voucher (PV)', meaning: 'The OSP Account\'s request to HO to pay one vendor invoice. One voucher per invoice, for the whole invoice amount.' },
        { term: 'HO Account Executive', meaning: 'The person at HO (Invoice Section) who receives the voucher documents and records each payment HO makes.' },
        { term: 'Before you confirm', meaning: 'The panel beside each form that lists every check. A red line says what to fix; the button unlocks when all lines are green.' },
        { term: 'Segregation of duties', meaning: 'One person cannot do two linked steps: the requester does not approve their own request, an earlier signer does not sign a later step, and the person who recorded a PO does not receive its goods.' },
    ],
    sections: [
        {
            id: 'overview',
            title: 'Who does what, step by step',
            summary: 'The whole purchase flow in order, with the person who does each step.',
            keywords: ['overview', 'process', 'flow', 'steps', 'who', 'purchase', 'material request', 'procurement', 'start', 'new staff', 'mulin', 'kawda', 'wada'],
            page: '/inventory/requests',
            requires: RBAC_PERMISSIONS.INVENTORY_READ,
            steps: [
                'Stores Officer: raises the material request (Material Requisitions → New Procurement Requisition (PRN)).',
                'Stores Manager: reviews it on Approvals → Procurement Approvals and approves or rejects.',
                'OSP Manager: approves it on the same page. The request then goes to Procurement.',
                'Stores Manager: hands the documents to Procurement and records "Documents submitted to Procurement" on the request.',
                'Procurement Officer: records the purchase order(s) approved in HO on Order Processing. When every line is ordered the request becomes Ready for GRN by itself.',
                'Stores Manager: receives the goods on Goods Receipt (GRN) with the vendor invoice and the Oracle GRN number.',
                'OSP Account Officer: raises the payment voucher for the vendor invoice on Payments to Head Office.',
                'OSP Account Manager, OSP Manager and Head of Section: sign the printed voucher. The Account Officer records "Signed by all three" with the scan, then sends the documents to HO.',
                'HO Account Executive: marks the documents received, then records each payment HO makes (in full or in parts).',
                'OSP Account Manager, OSP Manager and Head of Section: follow what HO paid on Vendor Payment Status.',
            ],
            tips: [
                'Each step sends a notice to the next person, so check your bell.',
                'The route strip at the top of each form shows where the request is and who it waits for.',
            ],
            anchors: [
                { file: REQUESTS, text: 'New Procurement Requisition (PRN)' },
                { file: APPROVALS, text: 'Procurement Approvals' },
                { file: GRN, text: 'Receive goods (GRN)' },
                { file: CHAIN, text: 'Signed by all three' },
            ],
        },
        {
            id: 'request',
            title: 'Raise a material request (Stores Officer)',
            summary: 'Ask for items to be bought from a local vendor.',
            keywords: ['raise', 'create', 'new', 'material request', 'prn', 'requisition', 'request items', 'buy', 'purchase request', 'stores officer', 'illanna', 'request ekak'],
            page: '/inventory/requests',
            requires: RBAC_PERMISSIONS.INVENTORY_WRITE,
            steps: [
                'Open Inventory / Stores → Material Requisitions and click New Procurement Requisition (PRN).',
                'Under Store and source, choose the Requesting store and Local purchase (vendor).',
                'Set Needed by (today or later) and fill in What the items are for.',
                'Add each item with its Quantity. Use Add new item line for more items.',
                'Check the "Before you confirm" panel: every line must be green.',
                'Click "Submit request to the Stores Manager". The Stores Manager gets a notice.',
            ],
            tips: [
                'Whole numbers only for items counted in Nos.',
                'An item may appear only once: put the total on one line.',
                'No price is shown or needed: Procurement records the HO-approved price on the PO.',
            ],
            images: [
                { src: '/guides/purchase/01-request.png', caption: 'The request form filled in: the "Before you confirm" panel on the right is green, so the submit button is unlocked.' },
            ],
            anchors: [
                { file: CREATE, text: 'Store and source' },
                { file: CREATE, text: 'Local purchase (vendor)' },
                { file: CREATE, text: 'Needed by' },
                { file: CREATE, text: 'What the items are for' },
                { file: CREATE, text: 'Add new item line' },
                { file: CREATE, text: 'Submit request to ${nextPerson' },
                { file: CREATE, text: 'Listed twice: put the total on one line' },
            ],
        },
        {
            id: 'review',
            title: 'Review and approve a request (Stores Manager, then OSP Manager)',
            summary: 'Check the quantities, approve or reject, and send the request to the next step.',
            keywords: ['approve', 'reject', 'review', 'approval', 'stores manager', 'osp manager', 'reduce quantity', 'anumatha', 'approve karanna'],
            page: '/procurement/approvals',
            requires: RBAC_PERMISSIONS.INVENTORY_APPROVE,
            steps: [
                'Open Approvals → Procurement Approvals and click the request.',
                'Read Check the request: the items, the quantity requested and what is in store.',
                'Under Your decision choose Approve or Reject.',
                'To approve less than requested, change the approved quantity and write the reason in Comments (needed when you reduce a quantity).',
                'To reject, write Why it is rejected.',
                'When the panel is green, click "Approve and send to …" (or "Reject and tell the requester").',
            ],
            tips: [
                'You cannot review a request you raised, and you cannot sign the OSP Manager step if you signed the Stores Manager step. Another person does it.',
                'Approve at most what was requested.',
            ],
            images: [
                { src: '/guides/purchase/02-stores-manager-review.png', caption: 'The Stores Manager\'s review: the request, the decision and the checks.' },
                { src: '/guides/purchase/03-osp-manager-approval.png', caption: 'The OSP Manager approves the same request after the Stores Manager.' },
            ],
            anchors: [
                { file: APPROVALS, text: 'Check the request' },
                { file: APPROVALS, text: 'Your decision' },
                { file: APPROVALS, text: 'Comments (needed when you reduce a quantity)' },
                { file: APPROVALS, text: 'Why it is rejected' },
                { file: APPROVALS, text: 'Reject and tell the requester' },
                { file: GATES, text: 'You raised this request, so another person reviews it' },
                { file: GATES, text: 'You signed an earlier step of this request, so another person signs this one' },
            ],
        },
        {
            id: 'documents',
            title: 'Hand the documents to Procurement (Stores Manager)',
            summary: 'Record that the approved request\'s documents went to Procurement, so the PO can be recorded.',
            keywords: ['documents', 'submit documents', 'procurement', 'docs', 'handover', 'lipi', 'documents yawanna'],
            page: '/inventory/requests',
            requires: RBAC_PERMISSIONS.INVENTORY_APPROVE,
            steps: [
                'Open Inventory / Stores → Material Requisitions and click the approved request.',
                'Click Documents submitted to Procurement.',
                'Read what happens next, then click Confirm the documents.',
            ],
            tips: ['This is done once and cannot be undone. Procurement cannot record a PO before it.'],
            images: [
                { src: '/guides/purchase/04-documents.png', caption: '"Documents submitted to Procurement": the confirmation says what happens next.' },
            ],
            anchors: [
                { file: REQUESTS, text: 'Documents submitted to Procurement' },
                { file: REQUESTS, text: 'Confirm the documents' },
            ],
        },
        {
            id: 'po',
            title: 'Record the purchase order (Procurement Officer)',
            summary: 'Record the PO approved in the HO system, with its vendor, quantities, HO-approved price and payment terms.',
            keywords: ['po', 'purchase order', 'record po', 'create po', 'vendor', 'order', 'procurement officer', 'credit', 'payment terms'],
            page: '/procurement/orders',
            requires: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
            steps: [
                'Open Procurement → Order Processing and find the request (Approved PRNs awaiting PO issue).',
                'Click Create PO (or + Add PO when the request already has a PO) and choose the vendor.',
                'For each line enter the Order Qty (at most the open quantity) and the HO-approved unit price.',
                'Under Payment terms (the order was approved in the HO system) choose how the order is paid. On credit needs the Credit days (from the goods received date) or the due date.',
                'When the panel is green, click "Record purchase order".',
                'When every line is ordered, the request becomes Ready for GRN by itself. If a vendor cannot supply everything, record a second PO for the open quantity.',
            ],
            images: [
                { src: '/guides/purchase/05-purchase-order.png', caption: 'Recording the purchase order: vendor, order quantity, HO-approved price and 30 credit days.' },
            ],
            anchors: [
                { file: ORDERS, text: 'Approved PRNs awaiting PO issue' },
                { file: ORDERS, text: 'Create PO' },
                { file: ORDERS, text: 'Add PO' },
                { file: ORDERS, text: 'Order Qty' },
                { file: ORDERS, text: 'Payment terms (the order was approved in the HO system)' },
                { file: ORDERS, text: 'Credit days (from the goods received date)' },
                { file: ORDERS, text: 'Record purchase order' },
            ],
        },
        {
            id: 'grn',
            title: 'Receive the goods (Stores Manager)',
            summary: 'Record what arrived against the PO, with the vendor invoice and the Oracle GRN number.',
            keywords: ['grn', 'receive', 'goods received', 'delivery', 'vendor invoice', 'oracle grn', 'reject', 'damaged', 'badu', 'badu labuna'],
            page: '/inventory/grn',
            requires: RBAC_PERMISSIONS.INVENTORY_GRN,
            steps: [
                'Open Inventory / Stores → Receiving & returns → Goods Receipt (GRN). Under Ready for GRN, click Create GRN on the request.',
                'The Receive goods (GRN) form opens. Choose the Purchase order: its open lines appear with the ordered quantity and price.',
                'For each line enter the Accepted quantity. Goods you do not accept go in Rejected, with the Reason for rejecting.',
                'Under Vendor invoice and Oracle GRN fill in the Vendor invoice number, Vendor invoice date, Goods value, without tax (Rs.), Tax (Rs.) and the Oracle GRN number, and attach the Scanned vendor invoice.',
                'When "Before you confirm" is green, click Confirm receipt. Stock is added and the vendor invoice is created for the OSP Account.',
            ],
            tips: [
                'The invoice can never be above the PO price (the price HO approved). If the vendor billed more, ask for a corrected invoice.',
                'The person who recorded the PO cannot receive it.',
            ],
            images: [
                { src: '/guides/purchase/06-grn.png', caption: 'The GRN: accepted quantity, vendor invoice, Oracle GRN number and the scanned invoice; the checks are green.' },
            ],
            anchors: [
                { file: GRN, text: 'Create GRN' },
                { file: GRN, text: 'Ready for GRN' },
                { file: GRN, text: 'Receive goods (GRN)' },
                { file: GRN, text: 'Vendor invoice and Oracle GRN' },
                { file: GRN, text: 'Oracle GRN number' },
                { file: GRN, text: 'Goods value, without tax (Rs.)' },
                { file: GRN, text: 'Scanned vendor invoice' },
                { file: GRN, text: 'Reason for rejecting' },
                { file: GRN, text: 'Confirm receipt' },
                { file: GRN_RULES, text: 'SEGREGATION_OF_DUTIES_VIOLATION' },
            ],
        },
        {
            id: 'voucher',
            title: 'Raise the payment voucher (OSP Account Officer)',
            summary: 'Ask HO to pay one vendor invoice.',
            keywords: ['voucher', 'payment voucher', 'pv', 'request payment', 'vendor invoice', 'account officer', 'pay vendor'],
            page: '/finance/ho-payments',
            requires: RBAC_PERMISSIONS.FINANCE_WRITE,
            steps: [
                'Open Finance & Accounting → Head Office Payments → Payments to Head Office.',
                'Under Vendor invoices awaiting a payment request (one per GRN), click Request payment on the invoice.',
                'Check the amount: it is the whole invoice (Still to pay on this invoice).',
                'When the panel is green, click "Create the payment voucher". Print it for the three signatures.',
            ],
            tips: ['One voucher per vendor invoice, always for the whole invoice amount. HO may still pay it in parts.'],
            images: [
                { src: '/guides/purchase/07-payment-voucher.png', caption: 'The payment voucher for one vendor invoice, for the whole invoice amount.' },
            ],
            anchors: [
                { file: HO, text: 'Vendor invoices awaiting a payment request (one per GRN)' },
                { file: HO, text: 'Request payment' },
                { file: HO, text: 'Still to pay on this invoice: ' },
                { file: HO, text: 'Create the payment voucher' },
            ],
        },
        {
            id: 'signatures',
            title: 'Record the signatures and send the documents (OSP Account Officer)',
            summary: 'After the OSP Account Manager, OSP Manager and Head of Section sign the voucher, record it and send the documents to HO.',
            keywords: ['sign', 'signatures', 'signed', 'scan', 'documents', 'send to ho', 'not signed', 'athsan'],
            page: '/procurement/payment-approvals',
            requires: RBAC_PERMISSIONS.FINANCE_WRITE,
            steps: [
                'Open Approvals → Vendor Payment Vouchers.',
                'On the voucher click Signed by all three, attach the Scan of the signed voucher, then click "Record: signed by all three". The vendor invoice is posted.',
                'If it was not signed, click Not signed and say why: the voucher goes back to draft.',
                'Send the signed voucher and its documents to the HO Invoice Section, then click Documents sent to HO and "Record: documents sent to HO". The HO Account Executive is told.',
            ],
            tips: ['The scan is required. A vendor invoice that does not match its PO and GRN needs a finance approver first.'],
            images: [
                { src: '/guides/purchase/08-signatures.png', caption: '"Signed by all three" with the scan of the signed voucher attached.' },
                { src: '/guides/purchase/09-documents-sent.png', caption: 'Recording that the documents were sent to HO.' },
            ],
            anchors: [
                { file: CHAIN, text: 'Signed by all three' },
                { file: CHAIN, text: 'Scan of the signed voucher' },
                { file: CHAIN, text: 'Record: signed by all three' },
                { file: CHAIN, text: 'Not signed' },
                { file: CHAIN, text: 'Record: documents sent to HO' },
            ],
        },
        {
            id: 'received',
            title: 'Receive the voucher documents at HO (HO Account Executive)',
            summary: 'Mark the documents received, or send them back when something is missing.',
            keywords: ['received', 'documents received', 'ho', 'not received', 'missing documents', 'account executive', 'invoice section'],
            page: '/procurement/payment-approvals',
            requires: RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD,
            steps: [
                'Open Approvals → Vendor Payment Vouchers.',
                'When the documents arrive, click Received at HO and "Record: documents received at HO". The voucher is now with HO for payment.',
                'If something is missing, click Not received, say Which documents are missing, and click "Send back: documents missing". The OSP Account sends them again.',
            ],
            tips: ['The person who raised the voucher cannot mark its documents received.'],
            images: [
                { src: '/guides/purchase/10-documents-received.png', caption: 'The HO Account Executive marks the documents received at HO.' },
            ],
            anchors: [
                { file: CHAIN, text: 'Received at HO' },
                { file: CHAIN, text: 'Record: documents received at HO' },
                { file: CHAIN, text: 'Which documents are missing' },
                { file: CHAIN, text: 'Send back: documents missing' },
            ],
        },
        {
            id: 'ho-payment',
            title: 'Record a payment HO made to the vendor (HO Account Executive)',
            summary: 'Record each payment HO makes on a voucher, in full or in parts; the system works out what is still to pay.',
            keywords: ['ho payment', 'record payment', 'part payment', 'paid', 'cheque', 'transfer', 'balance', 'account executive', 'gewwa', 'gewima', 'payment update'],
            page: '/finance/ho-payments',
            requires: RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD,
            steps: [
                'Open Finance & Accounting → Head Office Payments → Payments to Head Office and find the voucher.',
                'Click Record HO payment.',
                'Enter the Amount paid now, the Date paid and the Cheque / transfer reference.',
                'When the panel is green, click Record payment.',
                'If HO paid only part, record the rest the same way when it is paid. When nothing is left, the voucher and the vendor invoice become PAID.',
            ],
            tips: [
                'You do not need to know in advance whether it is a full or a part payment: the system adds up the payments and shows the balance.',
                'The amount cannot be more than is still to pay, and the date cannot be in the future.',
                'The OSP Account Manager, OSP Manager and Head of Section get one notice a day ("HO payments today") that each payment updates.',
            ],
            images: [
                { src: '/guides/purchase/11-ho-payment.png', caption: 'Recording a part payment HO made: amount paid now, date and transfer reference; the balance is checked.' },
            ],
            anchors: [
                { file: HO, text: 'Record HO payment' },
                { file: HO, text: 'Amount paid now' },
                { file: HO, text: 'Date paid' },
                { file: HO, text: 'Cheque / transfer reference' },
                { file: HO, text: 'Record payment' },
                { file: HO_SERVICE, text: 'is more than is still to pay on the voucher' },
                { file: DIGEST, text: 'HO payments today' },
            ],
        },
        {
            id: 'payment-status',
            title: 'See what HO paid (OSP Account Manager, OSP Manager, Head of Section)',
            summary: 'For each vendor voucher with HO: pending, partly paid or completed, how much was paid and how much is left.',
            keywords: ['payment status', 'vendor payment', 'paid', 'pending', 'partly paid', 'completed', 'remaining', 'balance', 'what ho paid', 'ithuru', 'kopamanada'],
            page: '/procurement/vendor-payments',
            requires: RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ,
            steps: [
                'Open Approvals → Vendor Payment Status (or Finance & Accounting → Head Office Payments → Vendor Payment Status).',
                'The three figures at the top show Pending at HO, Partly paid and Completed. Click one to show only those vouchers.',
                'Each row shows the invoice total, Paid by HO, Still to pay and the last HO payment.',
                'Click "N payments" to see each payment: date, amount, cheque or transfer, and who recorded it.',
            ],
            tips: ['The page only shows what the HO Account Executive recorded. A payment not yet recorded is not shown.'],
            images: [
                { src: '/guides/purchase/12-vendor-payment-status.png', caption: 'Vendor Payment Status: a voucher partly paid by HO, with its payment listed.' },
            ],
            anchors: [
                { file: STATUS, text: 'Vendor payment status' },
                { file: STATUS, text: 'Pending at HO' },
                { file: STATUS, text: 'Still to pay (Rs.)' },
                { file: DIGEST, text: 'Partly paid' },
            ],
        },
    ],
};
