import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import type { ModuleGuide } from './types';

const PAGE = 'src/app/service-orders/cpe-serials/page.tsx';
const INPUT = 'src/components/cpe/CpeSerialInput.tsx';
const ASSIST = 'src/components/cpe/useCpeSerialCheck.tsx';
const RULES = 'src/lib/cpe-serial-rules.ts';

export const CPE_SERIALS_GUIDE: ModuleGuide = {
    id: 'cpe-serials',
    title: 'CPE serials from the SLT CPE Locator',
    purpose:
        'SLT issues CPE devices (ONT / router, IPTV set-top box, phone) with known serial numbers through its CPE Locator, and an order may be '
        + 'completed or upgraded only with a serial SLT issued for that RTOM. Nexus keeps a register of these serials: who holds each one, on which '
        + 'order it is installed, and its full history. Serials are scanned with a barcode scanner or the camera, or typed. Every serial belongs to '
        + 'one RTOM and never moves to another area.',
    watch: [PAGE, INPUT, ASSIST, RULES, 'src/services/inventory/cpe-serial.service.ts', 'src/app/api/cpe-serials'],
    glossary: [
        { term: 'CPE', meaning: 'Customer premises equipment: the ONT / router, the IPTV set-top box (STB) and the phone installed at the customer.' },
        { term: 'CPE receipt (CPR)', meaning: 'A record of serials received from SLT, numbered CPR-YYYY-MM-NNNN. When the serials went straight to a contractor it also has an issue note (MIN).' },
        { term: 'Issue cycle', meaning: 'Each time SLT issues a serial (the first time, or again after it was taken back or repaired) a new cycle starts. In one cycle a serial is installed once.' },
    ],
    sections: [
        {
            id: 'overview',
            title: 'How CPE serials move',
            summary: 'From SLT to the contractor, recorded by the Area Coordinator or QC Officer, then onto an order; every step is kept in the serial history.',
            keywords: ['cpe', 'cpe locator', 'serial', 'serials', 'ont', 'router', 'stb', 'set top box', 'phone', 'slt serial', 'barcode', 'qr'],
            page: '/service-orders/cpe-serials',
            steps: [
                'SLT gives the devices to the contractors of the RTOM. The Area Coordinator or QC Officer of the RTOM scans their serials into Nexus for that contractor (Record SLT issue to contractor). This is a service order job; the stores do not record CPE.',
                'When an order is completed, the ONT and STB serials are scanned or typed on Confirm Completion; the CPE register says at once whether the serial was issued by SLT to that contractor in that RTOM.',
                'Open Service Orders → CPE Serials to see every serial of your RTOMs, its status and who holds it. Click a serial to see its full history.',
            ],
            tips: [
                'Until SLT starts the CPE Locator in an RTOM, the register only shows its answer on Confirm Completion; it does not stop the save ("not blocked yet").',
                'Each RTOM needs its store linked first (the administrator does it in Inventory / Stores, store form, RTOMs).',
            ],
            anchors: [{ file: PAGE, text: 'CPE Serials' }, { file: PAGE, text: 'Latest receipts from SLT' }],
        },
        {
            id: 'direct',
            title: 'Record the serials SLT gave a contractor (Area Coordinator or QC Officer)',
            summary: 'Scan or enter the serials a contractor received from SLT; they are recorded for that contractor in one step.',
            keywords: ['record', 'direct', 'contractor', 'issue', 'slt issue', 'small quantity', 'enter serial', 'scan serial', 'area coordinator', 'qc officer', 'denna', 'labuna'],
            page: '/service-orders/cpe-serials',
            requires: RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE,
            steps: [
                'Open Service Orders → CPE Serials and click Record SLT issue to contractor.',
                'Choose the RTOM, the Contractor who received the devices and the CPE type (ONT / Router, IPTV STB or Phone). Add the Model and the SLT reference if you have them, and the date in Received on.',
                'Click the serial field and scan each device with the barcode scanner (each scan ends on its own), use the camera button to read a barcode or QR code, or type the serial and press Enter. You can also click Upload Excel to read a list (Template gives the file to fill).',
                'Click Check the list. Each serial says New serial, Issued again by SLT, or what is wrong (for example a serial of another RTOM, or one already in the register).',
                'Remove or fix the lines in red, then click Save. You get the CPR number and the MIN number of the issue to the contractor.',
            ],
            tips: [
                'No approval is needed (owner decision). Only the Area Coordinator and the QC Officer record CPE serials, not the stores.',
                'A serial already installed somewhere cannot be added again; when SLT issues a recovered or repaired device again, it starts a new cycle.',
            ],
            anchors: [
                { file: PAGE, text: 'Record SLT issue to contractor' }, { file: PAGE, text: 'Check the list' }, { file: PAGE, text: 'Upload Excel' },
                { file: INPUT, text: 'Scan with the camera' }, { file: RULES, text: 'a serial never moves to another area' },
            ],
        },
        {
            id: 'on-order',
            title: 'Scan the CPE serials when completing an order',
            summary: 'On Confirm Completion scan or type the ONT and STB serials; the CPE register answers under each field.',
            keywords: ['complete', 'completion', 'ont serial', 'stb serial', 'scan', 'camera', 'existing', 're-use', 'upgrade', 'check serial'],
            page: '/service-orders/work-order',
            requires: RBAC_PERMISSIONS.SOD_WRITE,
            steps: [
                'In COMPLETE ORDER, click the ONT (Router) Serial Number field and scan the device with the barcode scanner, or click the camera button beside the field, or type it.',
                'Read the line under the field: "SLT serial: Issued by SLT to <contractor>" is correct; "CPE register: ..." says what is wrong (not issued by SLT, another RTOM, with another contractor, already installed).',
                'On an upgrade where the customer keeps the device, choose Existing / Re-use: the serial must be the one already installed for that voice number.',
                'Do the same for each STB serial.',
            ],
            tips: ['While the register is still being filled the answer is shown but the order is saved anyway ("not blocked yet").'],
            anchors: [{ file: ASSIST, text: 'Scan with the camera (QR code or barcode)' }, { file: INPUT, text: 'SLT serial: ' }, { file: INPUT, text: 'not blocked yet' }],
        },
        {
            id: 'register',
            title: 'Find a serial and read its history',
            summary: 'Search the register by scanning or typing; open a serial to see every step it went through.',
            keywords: ['find serial', 'search', 'history', 'where is', 'register', 'status', 'who has', 'installed on'],
            page: '/service-orders/cpe-serials',
            requires: RBAC_PERMISSIONS.INVENTORY_CPE_READ,
            steps: [
                'Open Service Orders → CPE Serials. The buttons at the top count the serials by status (In store, With contractor, Installed, Recovered from customer, Faulty, Returned to SLT); click one to show only those.',
                'Scan or type a serial (or part of it) in Find a serial and press Enter. Choose an RTOM or a type to narrow the list.',
                'Click a serial to open its history: every receipt, issue note, order and person, with the date.',
            ],
            anchors: [{ file: PAGE, text: 'Find a serial' }, { file: PAGE, text: 'History' }],
        },
    ],
};
