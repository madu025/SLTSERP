const fs = require('fs');
const path = require('path');

const agentsPath = path.join(__dirname, '..', 'AGENTS.md');
let content = fs.readFileSync(agentsPath, 'utf8');

const updatedRules = `10. **🆕 [AUDIT-DERIVED] Strict Database ID & Primary Key Strategy**: Never use a plain \`String @id @default(cuid())\` blindly for database models. All primary keys MUST use native PostgreSQL \`UUID v7\` (\`id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid\`) or \`BigInt @id @default(autoincrement())\` for minimal 16-byte storage size and maximum B-Tree index cache performance. For auditable business documents (Invoices, MIN, GRN, MRN, Service Orders), decouple internal surrogate primary keys (\`id\`) from human-readable business sequence codes (\`MIN-YYYY-MM-XXXX\`, \`INV-YYYY-XXXX\`) backed by \`@unique\` indexes.
11. **🆕 [AUDIT-DERIVED] Explicit Currency & Numeric Precision**: Never use \`Float\` or plain \`String\` types in Prisma for monetary amounts, financial ledgers, unit costs, revenue, or material quantities. Always use PostgreSQL \`Decimal(14, 2)\` or \`Decimal(15, 4)\` (\`@db.Decimal(14,2)\`) to eliminate IEEE 754 floating-point rounding errors.
12. **🆕 [AUDIT-DERIVED] Prohibition of Generic Text Strings**: Generic \`String\` is strictly prohibited for any schema field where a semantic native database type exists. Primary keys MUST use \`@db.Uuid\` (\`uuid_generate_v7()\`) or \`BigInt\`. Statuses/Categories MUST use Prisma \`Enum\`. Financial values MUST use \`Decimal(14,2)\`. Dates/Times MUST use \`DateTime\`. Plain \`String\` is ONLY allowed for genuine arbitrary free-text (e.g. \`address\`, \`comments\`, \`customerName\`).`;

content = content.replace(
  /10\. \*\*🆕 \[AUDIT-DERIVED\] Strict Database ID[\s\S]*?11\. \*\*🆕 \[AUDIT-DERIVED\] Explicit Currency & Numeric Precision\*\*: [^\n]*/,
  updatedRules
);

fs.writeFileSync(agentsPath, content, 'utf8');
console.log('Successfully updated AGENTS.md with Rule 12 (Prohibition of Generic Text Strings)');
