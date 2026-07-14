/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Helpdesk (ITSM) data...");

  // 1. Fetch test users to assign assets/tickets to
  const users = await prisma.user.findMany({
    select: { id: true, username: true }
  });

  if (users.length === 0) {
    console.error("No users found in database to assign assets. Run prisma/seed.js first!");
    return;
  }

  const adminUser = users.find(u => u.username === 'admin') || users[0];
  const coordinatorUser = users.find(u => u.username === 'coordinator') || users[0];
  const qcUser = users.find(u => u.username === 'qcofficer') || users[0];

  // 2. Create Knowledge Base Articles
  const kbArticles = [
    {
      title: "Connecting to the Corporate VPN from home",
      category: "VPN",
      content: "To access SLTSERP systems securely from home, follow these steps:\n\n" +
        "1. Open FortiClient VPN on your laptop.\n" +
        "2. Click 'Configure VPN'.\n" +
        "3. Select 'SSL-VPN' and enter configuration details:\n" +
        "   - Connection Name: SLTS Corporate VPN\n" +
        "   - Remote Gateway: vpn.nexuserp.com\n" +
        "   - Port: 10443\n" +
        "4. Enter your ERP username and password.\n" +
        "5. Enter the 6-digit OTP code from your authenticator app and click Connect."
    },
    {
      title: "How to fix offline office printer issues",
      category: "Printers",
      content: "If the Colombo HQ HP LaserJet network printer shows 'Offline':\n\n" +
        "1. Check if the printer's power cable is firmly connected and the screen is turned on.\n" +
        "2. Make sure the blue ethernet network cable is plugged in at the back of the printer.\n" +
        "3. Turn off the printer, wait 10 seconds, then power it back on to refresh IP leases.\n" +
        "4. On your laptop, open Command Prompt and type: 'net stop spooler' followed by 'net start spooler' to reset spool settings.\n" +
        "5. If it still doesn't print, submit a support ticket mentioning the Printer asset number."
    },
    {
      title: "Self-service password resets",
      category: "Passwords",
      content: "To reset your password if locked out of the ERP system:\n\n" +
        "1. Open the login screen at http://localhost:3000.\n" +
        "2. Click the 'Forgot Password' link below the input box.\n" +
        "3. Enter your company email or username and click Send Code.\n" +
        "4. Verify the safety code sent to your mobile phone or backup email address.\n" +
        "5. Fill in your security question answer.\n" +
        "6. Set your new password (must contain at least 8 characters, one number, and one symbol)."
    },
    {
      title: "Configuring Outlook corporate email on Outlook Web",
      category: "Outlook",
      content: "To sync your mailboxes outside the office:\n\n" +
        "1. Open your browser and go to https://outlook.office.com.\n" +
        "2. Login with your ERP username followed by @nexuserp.com.\n" +
        "3. Approve the login notification sent to Microsoft Authenticator.\n" +
        "4. Let Outlook download configurations. Offline mailboxes should sync in under 5 minutes."
    }
  ];

  console.log("Creating Knowledge Base articles...");
  for (const art of kbArticles) {
    await prisma.knowledgeBaseArticle.create({
      data: art
    });
  }

  // 3. Create IT Assets
  const assets = [
    {
      assetNumber: "SLT-IT-2026-001",
      serialNumber: "SN-LNV-T14-99881",
      deviceType: "LAPTOP",
      brand: "Lenovo",
      model: "ThinkPad T14 Gen 4",
      assignedUserId: coordinatorUser.id,
      department: "OSP Projects",
      location: "Colombo HQ",
      status: "ACTIVE"
    },
    {
      assetNumber: "SLT-IT-2026-002",
      serialNumber: "SN-HP-EB-55011",
      deviceType: "LAPTOP",
      brand: "HP",
      model: "EliteBook 840 G10",
      assignedUserId: qcUser.id,
      department: "QA/QC",
      location: "Kandy OPMC",
      status: "ACTIVE"
    },
    {
      assetNumber: "SLT-IT-2026-003",
      serialNumber: "SN-HP-LJ-30044",
      deviceType: "PRINTER",
      brand: "HP",
      model: "LaserJet Pro MFP M428fdw",
      assignedUserId: null,
      department: "Finance",
      location: "Colombo HQ",
      status: "ACTIVE"
    },
    {
      assetNumber: "SLT-IT-2026-004",
      serialNumber: "SN-DELL-OPT-7080",
      deviceType: "DESKTOP",
      brand: "Dell",
      model: "OptiPlex 7080 Micro",
      assignedUserId: adminUser.id,
      department: "IT Systems",
      location: "Galle OPMC",
      status: "SPARE"
    }
  ];

  console.log("Creating IT Assets...");
  const createdAssets = [];
  for (const assetData of assets) {
    const created = await prisma.iTAsset.create({
      data: assetData
    });
    createdAssets.push(created);
  }

  // 4. Create Mock Tickets
  const tickets = [
    {
      ticketNumber: "IT-20260714-0001",
      assetId: createdAssets[0].id,
      userId: coordinatorUser.id,
      category: "BROKEN_DISPLAY",
      description: "My Lenovo laptop slipped off my desk and the screen has a spiderweb crack. The screen stays completely white when powering on.",
      priority: "CRITICAL",
      status: "OPEN",
      assignedToId: null,
      anydeskId: null
    },
    {
      ticketNumber: "IT-20260714-0002",
      assetId: createdAssets[1].id,
      userId: qcUser.id,
      category: "NETWORK_ISSUE",
      description: "Every time I connect to Kandy OPMC WiFi, my corporate VPN disconnects and throws an authentication error (Error 401). My password is correct.",
      priority: "HIGH",
      status: "ASSIGNED",
      assignedToId: adminUser.id,
      anydeskId: "987654321"
    },
    {
      ticketNumber: "IT-20260714-0003",
      assetId: createdAssets[2].id,
      userId: coordinatorUser.id,
      category: "PRINTER_ISSUE",
      description: "HP LaserJet printer is offline. Checked power cables, rebooted, but invoices won't print from the queue.",
      priority: "MEDIUM",
      status: "RESOLVED",
      assignedToId: adminUser.id,
      anydeskId: null
    }
  ];

  console.log("Creating tickets...");
  for (const t of tickets) {
    const created = await prisma.ticket.create({
      data: t
    });

    // Create history logs
    await prisma.ticketUpdate.create({
      data: {
        ticketId: created.id,
        userId: created.userId,
        message: "Ticket registered by user: " + created.description.substring(0, 50) + "...",
        statusFrom: "OPEN",
        statusTo: created.status
      }
    });

    if (created.status === "ASSIGNED") {
      await prisma.ticketUpdate.create({
        data: {
          ticketId: created.id,
          userId: adminUser.id,
          message: "Ticket assigned to IT Support: " + adminUser.username,
          statusFrom: "OPEN",
          statusTo: "ASSIGNED"
        }
      });
    } else if (created.status === "RESOLVED") {
      await prisma.ticketUpdate.create({
        data: {
          ticketId: created.id,
          userId: adminUser.id,
          message: "Printer spooler service restarted and paper jam cleared. Verified successful printing.",
          statusFrom: "IN_PROGRESS",
          statusTo: "RESOLVED"
        }
      });
    }
  }

  console.log("Helpdesk ITSM seeding complete! 🚀");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
