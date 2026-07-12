process.env.READ_REPLICA_URL = "";
import { prisma } from '../src/lib/prisma';
import { CostAllocationService } from '../src/services/finance/cost-allocation.service';

async function main() {
    console.log("=== STARTING COST ALLOCATION REFAC INTEGRATION TEST ===");
    let createdMemoId: string | null = null;
    let createdJournalId: string | null = null;

    try {
        // 1. Create the multi-item Cost Allocation Memo
        const memo = await CostAllocationService.createAllocationMemo({
            title: "Test multi-item allocation memo",
            description: "Cost allocation for 10 laptops and 2 printers",
            allocationTarget: "OPMC Colombo & IT Support",
            approvedAt: "2026-06-01T10:00:00Z",
            receivedAt: "2026-06-05T14:30:00Z",
            documentUrl: "https://docs.slt.lk/test-memo-101.pdf",
            items: [
                {
                    itemName: "Dell Latitude Laptops",
                    quantity: 10,
                    unitCost: 150000 // 1,500,000 LKR total
                },
                {
                    itemName: "HP LaserJet Printers",
                    quantity: 2,
                    unitCost: 50000 // 100,000 LKR total
                }
            ]
        });

        createdMemoId = memo.id;
        createdJournalId = memo.journalEntryId;

        console.log("Cost Allocation Memo created successfully!");
        console.log("Memo Number:", memo.memoNumber);
        console.log("Allocation Target:", memo.allocationTarget);
        console.log("Approved At:", memo.approvedAt);
        console.log("Received At:", memo.receivedAt);
        console.log("Document URL:", memo.documentUrl);
        console.log("Total Cost (Calculated):", memo.totalCost);
        console.log("Items Count:", memo.items.length);
        console.log("Linked GL Journal Entry ID:", memo.journalEntryId);

        // Assert values
        if (memo.totalCost !== 1600000) {
            throw new Error(`ASSERTION_FAILED: Expected total cost 1600000, got ${memo.totalCost}`);
        }
        if (memo.items.length !== 2) {
            throw new Error(`ASSERTION_FAILED: Expected 2 items, got ${memo.items.length}`);
        }
        if (!memo.memoNumber.startsWith('MEMO-')) {
            throw new Error(`ASSERTION_FAILED: Expected memo number starting with MEMO-, got ${memo.memoNumber}`);
        }

        // 2. Fetch and verify GL journal postings
        if (!memo.journalEntryId) {
            throw new Error("ASSERTION_FAILED: Journal entry ID was not linked to the memo.");
        }

        const journal = await prisma.journalEntry.findUnique({
            where: { id: memo.journalEntryId },
            include: { lines: true }
        });

        if (!journal) {
            throw new Error(`ASSERTION_FAILED: Journal entry with ID ${memo.journalEntryId} was not found in database.`);
        }

        console.log("\nJournal Entry verified:");
        console.log("Reference Type:", journal.referenceType);
        console.log("Description:", journal.description);
        
        for (const line of journal.lines) {
            console.log(`- Line: [${line.accountCode}] ${line.accountName} | Debit: ${line.debit} | Credit: ${line.credit}`);
        }

        // Assert debit/credit lines
        const debitLine = journal.lines.find(l => l.accountCode === 'EXP-OSP-8010');
        const creditLine = journal.lines.find(l => l.accountCode === 'CLR-HO-9010');

        if (!debitLine || Number(debitLine.debit) !== 1600000) {
            throw new Error("ASSERTION_FAILED: Missing or incorrect OSP expense debit line.");
        }
        if (!creditLine || Number(creditLine.credit) !== 1600000) {
            throw new Error("ASSERTION_FAILED: Missing or incorrect Head Office clearing credit line.");
        }

        console.log("\nMathematical and Ledger integrity verified successfully! 100% Correct.");

    } catch (error) {
        console.error("Cost Allocation test failed with error:", error);
        process.exit(1);
    } finally {
        console.log("\nCleaning up temporary test database entries...");
        if (createdMemoId) {
            // Cascade delete will automatically delete items
            await prisma.costAllocationMemo.delete({ where: { id: createdMemoId } }).catch(console.error);
        }
        if (createdJournalId) {
            await prisma.journalEntry.delete({ where: { id: createdJournalId } }).catch(console.error);
        }
        console.log("Cleanup completed.");
    }
}

main();
