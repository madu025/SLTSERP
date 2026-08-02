const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. AuditLog hash
schema = schema.replace(
    '    userAgent String?\n    createdAt DateTime',
    '    userAgent String?\n    hash      String?    // SHA-256 validation\n    createdAt DateTime'
);
if (!schema.includes('hash      String?    // SHA-256 validation')) {
    // try different CRLF
    schema = schema.replace(
        '    userAgent String?\r\n    createdAt DateTime',
        '    userAgent String?\r\n    hash      String?    // SHA-256 validation\r\n    createdAt DateTime'
    );
}

// 2. InventoryTransaction hash
schema = schema.replace(
    '    remarks         String?\n    createdAt       DateTime',
    '    remarks         String?\n    hash            String?    // SHA-256 validation\n    createdAt       DateTime'
);
if (!schema.includes('    hash            String?    // SHA-256 validation')) {
    schema = schema.replace(
        '    remarks         String?\r\n    createdAt       DateTime',
        '    remarks         String?\r\n    hash            String?    // SHA-256 validation\r\n    createdAt       DateTime'
    );
}

// 3. SODForensicAudit json extraction
schema = schema.replace(
    '    auditData       Json         // [{ name: string, status: string, uuid: string }]',
    '    auditData       Json?        // @deprecated\n    auditItems      SODAuditItem[]'
);
if (!schema.includes('auditItems      SODAuditItem[]')) {
     schema = schema.replace(
        '    auditData       Json         // [{ name: string, status: string, uuid: string }]',
        '    auditData       Json?        // @deprecated\r\n    auditItems      SODAuditItem[]'
    );
}

const sodAuditItemModel = `
model SODAuditItem {
    id        String   @id @default(cuid())
    sodAuditId String
    name      String
    status    String
    uuid      String
    createdAt DateTime @default(now())
    sodAudit  SODForensicAudit @relation(fields: [sodAuditId], references: [id], onDelete: Cascade)

    @@index([sodAuditId])
}
`;
if (!schema.includes('model SODAuditItem')) {
    schema += '\n' + sodAuditItemModel;
}

// 4. Checklist field
const checklistMatch = schema.match(/model\s+(\w+)\s+\{[^}]*checklist\s+Json/);
if (checklistMatch) {
    const modelName = checklistMatch[1];
    schema = schema.replace(
        '    checklist       Json        // JSON array of checked list items',
        '    checklistRaw    Json?       // @deprecated\n    checklistItems  ChecklistItem[]'
    );
    
    const checklistItemModel = `
model ChecklistItem {
    id          String   @id @default(cuid())
    parentId    String
    item        String
    isChecked   Boolean  @default(false)
    parent      ${modelName} @relation(fields: [parentId], references: [id], onDelete: Cascade)

    @@index([parentId])
}
`;
    if (!schema.includes('model ChecklistItem')) {
        schema += '\n' + checklistItemModel;
    }
}

// Enforce onDelete: Restrict on AuditLog
schema = schema.replace(
    'user      User     @relation(fields: [userId], references: [id])',
    'user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)'
);

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema updated successfully.');
