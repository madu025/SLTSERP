const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

(async () => {
  try {
    const newPassword = await bcrypt.hash('Admin@123', 12);
    
    const updated = await p.user.update({
      where: { username: 'qa_contractor' },
      data: { 
        password: newPassword,
        mustChangePassword: false
      }
    });
    
    console.log('Password reset for qa_contractor');
    console.log('User ID:', updated.id);
    console.log('New password: Admin@123');

    await p.$disconnect();
  } catch (e) {
    console.error(e);
    await p.$disconnect();
  }
})();
