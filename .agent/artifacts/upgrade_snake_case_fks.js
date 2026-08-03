const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', '..', 'prisma', 'schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.prisma'));

console.log(`Processing snake_case foreign keys in ${files.length} schema files...`);

let totalFkUpgraded = 0;

files.forEach(file => {
  const filePath = path.join(schemaDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  const lines = content.split('\n');
  const updatedLines = lines.map(line => {
    // Regex for snake_case foreign key field definition: e.g. current_driver_id String? or vehicle_id String
    if (!line.includes('@db.Uuid') && !line.includes('@id') && line.match(/^\s*[a-zA-Z0-9_]+_id\s+String\??/)) {
      totalFkUpgraded++;
      return line.replace(/(^\s*[a-zA-Z0-9_]+_id\s+String\??)/, '$1 @db.Uuid');
    }
    return line;
  });

  content = updatedLines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`Completed upgrade: ${totalFkUpgraded} snake_case Foreign Keys upgraded to @db.Uuid.`);
