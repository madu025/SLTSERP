const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('InventoryItem model fields:', JSON.stringify(prisma.inventoryItem.fields, null, 2));
console.log('Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
process.exit(0);
