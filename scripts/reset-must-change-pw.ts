import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.update({ where: { username: 'thilina' }, data: { mustChangePassword: true } })
  .then(() => { console.log('Reset done'); p.$disconnect(); })
  .catch(e => { console.error(e); p.$disconnect(); });
