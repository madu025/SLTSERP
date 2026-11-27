import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import type { ModuleGuide } from './types';

const PAGE = 'src/app/inventory/admin/initial/page.tsx';
const RULES = 'src/lib/opening-stock-rules.ts';

export const OPENING_STOCK_GUIDE: ModuleGuide = {
    id: 'opening-stock',
    title: 'Opening stock: starting a store on Nexus',
    purpose:
        'When a store starts on Nexus, what it already holds is loaded once from a physical count. The store uploads the count with its cost, '
        + 'another person checks and approves it, and only then does the stock enter the store, as numbered FIFO batches valued at that cost. '
        + 'Later differences are corrected with a cycle count, not a second opening load.',
    watch: [PAGE, RULES, 'src/services/inventory/opening-stock.service.ts', 'src/app/api/inventory/opening-stock'],
    glossary: [
        { term: 'Opening stock load', meaning: 'One store\'s counted stock at go-live, numbered OSL-YYYY-MM-NNNN. It waits for approval, then enters the store.' },
        { term: 'Unit cost', meaning: 'What one unit is worth (Rs.). The stock is valued at this cost; it cannot be zero.' },
        { term: 'Count sheet', meaning: 'The printed sheet of the physical count, signed by the people who counted. Its scan stays with the load.' },
    ],
    sections: [
        {
            id: 'prepare',
            title: 'Before you start: count the store and check the costs',
            summary: 'What to have ready before loading a store.',
            keywords: ['go live', 'golive', 'start', 'first time', 'initial', 'opening', 'prepare', 'count', 'physical count', 'cost', 'mulin', 'patan ganna'],
            page: '/inventory/admin/initial',
            requires: RBAC_PERMISSIONS.INVENTORY_MASTER,
            steps: [
                'Make sure every item the store holds is in the item list (Item Master Data) with its unit.',
                'Count the store on one day and write the counts on a printed sheet. The people who counted sign it.',
                'Agree the unit cost of each item with Finance: the stock is valued at it.',
            ],
            tips: ['Load a store once, from one count. Do not issue or receive in that store between the count and the approval.'],
            anchors: [{ file: PAGE, text: 'Opening stock' }],
        },
        {
            id: 'submit',
            title: 'Upload a store\'s opening stock (Stores Manager or Stores Executive)',
            summary: 'Fill the template with the counted quantities and costs, upload it with the signed count sheet, and submit it for approval.',
            keywords: ['upload', 'excel', 'template', 'submit', 'opening stock', 'initial stock', 'load stock', 'add material', 'material add', 'stores vice', 'store wise'],
            page: '/inventory/admin/initial',
            requires: RBAC_PERMISSIONS.INVENTORY_MASTER,
            steps: [
                'Open Inventory / Stores → Setup → Opening Stock.',
                'Under Store and count date choose the Store and the Count date.',
                'Click Download template. Fill in Quantity and check the Unit cost (Rs.) for each item the store holds; leave the other rows empty. Batch number and Expiry date are optional.',
                'Choose the filled file under Filled count sheet (.xlsx). Each row is shown with its value; a row with a problem is red and says what to fix.',
                'Attach the Scan of the signed count sheet.',
                'When "Before you confirm" is green, click "Submit for approval". The load gets its OSL number and waits for another person.',
            ],
            tips: [
                'Whole numbers only for items counted in Nos.',
                'An item that already has stock (or an open load) in the store cannot be loaded again: use a cycle count to correct it.',
            ],
            anchors: [
                { file: PAGE, text: 'Store and count date' },
                { file: PAGE, text: 'Download template' },
                { file: PAGE, text: 'Filled count sheet (.xlsx)' },
                { file: PAGE, text: 'Scan of the signed count sheet' },
                { file: PAGE, text: 'Submit for approval' },
                { file: RULES, text: 'Already loaded in this store (use a cycle count to correct)' },
            ],
        },
        {
            id: 'approve',
            title: 'Check and approve an opening stock load (another person)',
            summary: 'Compare the load with the signed count sheet, then approve it (the stock enters the store) or reject it with the reason.',
            keywords: ['approve', 'reject', 'check', 'opening stock', 'second person', 'anumatha'],
            page: '/inventory/admin/initial',
            requires: RBAC_PERMISSIONS.INVENTORY_APPROVE,
            steps: [
                'Open Inventory / Stores → Setup → Opening Stock. Under Opening stock loads, click Check and decide on the load.',
                'Compare the lines with the Signed count sheet.',
                'Under Your decision choose Approve, or Reject and write Why it is rejected.',
                'When the panel is green, click "Approve: put the stock in the store" (or "Reject and tell the submitter").',
            ],
            tips: [
                'You cannot approve a load you submitted.',
                'On approval each line becomes a numbered FIFO batch at its unit cost, and the stock ledger records it as the opening balance.',
            ],
            anchors: [
                { file: PAGE, text: 'Check and decide' },
                { file: PAGE, text: 'Your decision' },
                { file: PAGE, text: 'Approve: put the stock in the store' },
                { file: RULES, text: 'You submitted this load, so another person approves it' },
            ],
        },
    ],
};
