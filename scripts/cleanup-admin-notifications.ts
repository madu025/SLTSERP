import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

p.notification.deleteMany({
  where: {
    title: 'Profile Updated',
    userId: '019fc74b-12aa-0ef0-4166-64d59b99ad29'
  }
}).then(result => {
  console.log(`Deleted ${result.count} incorrect notifications`);
  p.$disconnect();
}).catch(e => {
  console.error(e);
  p.$disconnect();
});
