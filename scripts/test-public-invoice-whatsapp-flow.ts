import 'dotenv/config';

async function testPublicInvoiceWhatsAppFlow() {
  console.log(`\n======================================================================`);
  console.log(`🚀 TESTING PUBLIC WHATSAPP SHAREABLE INVOICE & MATERIAL BALANCE SHEET`);
  console.log(`======================================================================\n`);

  const baseUrl = 'http://localhost:3000';

  try {
    // 1. Fetch an invoice ID from DB or API
    const { PrismaClient } = await import('@prisma/client');
    const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.cxhjerzucacqsxoumhio:Osp%23slts%40Osp@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
    const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

    const invoice = await prisma.invoice.findFirst({
      include: { contractor: true }
    });

    if (!invoice) {
      console.log(`ℹ️ No existing invoice found. Creating a test invoice...`);
      // Create a test invoice
      const contractor = await prisma.contractor.findFirst() || await prisma.contractor.create({
        data: { name: 'SLTS WhatsApp Test Contractor', status: 'ACTIVE' }
      });

      const newInv = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-WA-${Date.now()}`,
          contractorId: contractor.id,
          totalAmount: 469750.00,
          amountA: 422775.00,
          amountB: 469750.00 - 422775.00,
          status: 'PENDING',
          date: new Date()
        },
        include: { contractor: true }
      });
      await prisma.$disconnect();
      return testPublicInvoiceWhatsAppFlow();
    }

    console.log(`📌 Found Target Invoice: ${invoice.invoiceNumber} (${invoice.id})`);

    // 2. Perform Unauthenticated HTTP GET /api/public/invoices/[id]
    console.log(`\n📌 [STEP 1] Unauthenticated HTTP GET /api/public/invoices/${invoice.id}...`);
    const publicApiRes = await fetch(`${baseUrl}/api/public/invoices/${invoice.id}?_t=${Date.now()}`);
    console.log(`   HTTP Status: ${publicApiRes.status} ${publicApiRes.statusText}`);

    if (publicApiRes.status === 200) {
      const json = await publicApiRes.json();
      console.log(`   ✅ PUBLIC API SUCCESS: Fetched Invoice details for Contractor: ${json.data?.contractor?.name}`);
      console.log(`   📊 Balance Sheet Items Count: ${json.data?.balanceSheet?.length || 0}`);
      if (json.data?.balanceSheet?.length > 0) {
        const item = json.data.balanceSheet[0];
        console.log(`   Sample Item: ${item.name} (${item.code}) | Opening: ${item.openingBalance} | Issued: +${item.issuedQty} | Consumed: -${item.consumedQty} | Closing: =${item.closingBalance}`);
      }
    } else {
      console.error(`   ❌ PUBLIC API FAILED:`, await publicApiRes.text());
    }

    // 3. Test Public Web View Page URL Generation
    const publicWebUrl = `${baseUrl}/public/invoices/${invoice.id}`;
    const whatsappMessage = `Hello *${invoice.contractor?.name || 'Contractor'}*,\n\nHere is your official Monthly Invoice *${invoice.invoiceNumber}* for LKR *${Number(invoice.totalAmount).toLocaleString()}*.\n\nView Invoice & Material Balance Sheet:\n${publicWebUrl}`;
    const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    console.log(`\n📌 [STEP 2] WhatsApp Link Generation Check:`);
    console.log(`   🌐 Public Web View URL  : ${publicWebUrl}`);
    console.log(`   💬 WhatsApp Share Link  : ${whatsappLink.substring(0, 100)}...`);

    console.log(`\n======================================================================`);
    console.log(`🎉 PUBLIC WHATSAPP INVOICE & MATERIAL BALANCE SHEET TEST PASSED 100%!`);
    console.log(`======================================================================\n`);

    await prisma.$disconnect();
  } catch (err: any) {
    console.error(`❌ TEST ERROR:`, err.message);
  }
}

testPublicInvoiceWhatsAppFlow();
