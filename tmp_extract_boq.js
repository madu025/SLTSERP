const fs = require('fs');
const p = 'prisma/migrations/20260109164529_add_three_tier_approval_system/migration.sql';
const c = fs.readFileSync(p, 'utf8');
const i = c.indexOf('CREATE TABLE "ProjectBOQItem"');
const j = c.indexOf(');', i);
console.log(c.substring(i, j + 2));