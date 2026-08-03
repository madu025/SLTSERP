const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', '..', 'prisma', 'schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.prisma'));

console.log(`Analyzing foreign key indexes across ${files.length} schema files...`);

let totalIndexesAdded = 0;

files.forEach(file => {
  const filePath = path.join(schemaDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Split into model blocks
  const modelRegex = /(model\s+[A-Za-z0-9_]+\s*\{[\s\S]*?\n\})/g;
  let fileIndexesAdded = 0;

  content = content.replace(modelRegex, (modelBlock) => {
    // Extract existing indexes in this model
    const existingIndexMatches = modelBlock.match(/@@index\(\[([^\]]+)\]\)/g) || [];
    const existingIndexedFields = new Set();
    existingIndexMatches.forEach(idx => {
      const match = idx.match(/@@index\(\[([^\]]+)\]\)/);
      if (match) {
        const fields = match[1].split(',').map(f => f.trim().replace(/^"/, '').replace(/"$/, ''));
        fields.forEach(f => existingIndexedFields.add(f));
      }
    });

    // Find foreign key fields (fields ending in Id or _id with @db.Uuid or Relation)
    const fkLines = modelBlock.split('\n').filter(line => {
      return (line.match(/^\s*[a-zA-Z0-9_]+(Id|_id)\s+String/));
    });

    const newIndexes = [];
    fkLines.forEach(line => {
      const fieldMatch = line.match(/^\s*([a-zA-Z0-9_]+(Id|_id))\s+/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        if (!existingIndexedFields.has(fieldName)) {
          existingIndexedFields.add(fieldName);
          newIndexes.push(`  @@index([${fieldName}])`);
          fileIndexesAdded++;
        }
      }
    });

    if (newIndexes.length > 0) {
      // Insert new indexes before the closing brace
      const closingBraceIndex = modelBlock.lastIndexOf('}');
      return modelBlock.slice(0, closingBraceIndex) + newIndexes.join('\n') + '\n}';
    }

    return modelBlock;
  });

  totalIndexesAdded += fileIndexesAdded;
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`Completed foreign key indexing: ${totalIndexesAdded} new @@index entries added across schemas.`);
