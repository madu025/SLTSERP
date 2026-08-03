const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', '..', 'prisma', 'schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.prisma'));

console.log(`Processing ${files.length} schema files in ${schemaDir}...`);

let totalIdUpgraded = 0;
let totalFkUpgraded = 0;

files.forEach(file => {
  const filePath = path.join(schemaDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Upgrade Primary Keys: @id @default(cuid()) or @default(uuid()) -> @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  const idRegex = /([a-zA-Z0-9_]+)\s+String\s+@id\s+@default\((cuid|uuid)\(\)\)/g;
  let fileIdMatches = 0;
  content = content.replace(idRegex, (match, fieldName) => {
    fileIdMatches++;
    return `${fieldName} String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid`;
  });
  totalIdUpgraded += fileIdMatches;

  // 2. Upgrade Foreign Keys: field ending in Id String or Id String? without @db.Uuid
  // Match lines like:   opmcId String
  //                or:  contractorId String?
  // Avoid replacing if @db.Uuid or @relation is already present on line
  const lines = content.split('\n');
  const updatedLines = lines.map(line => {
    // Regex for foreign key field definition: e.g. opmcId String  or  contractorId String?
    // Exclude line if it already has @db.Uuid, @id, @@map, or is an enum line
    if (!line.includes('@db.Uuid') && !line.includes('@id') && line.match(/^\s*[a-zA-Z0-9_]+Id\s+String\??/)) {
      totalFkUpgraded++;
      return line.replace(/(^\s*[a-zA-Z0-9_]+Id\s+String\??)/, '$1 @db.Uuid');
    }
    return line;
  });

  content = updatedLines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`Completed upgrade: ${totalIdUpgraded} Primary Keys and ${totalFkUpgraded} Foreign Keys upgraded to @db.Uuid (UUID v7).`);
