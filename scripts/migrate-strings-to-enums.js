const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Parse the schema by blocks (models)
const models = schema.split(/model\s+(\w+)\s+\{/);
let updatedSchema = models[0];

const enumMap = {
    Notification: {
        type: 'NotificationTypeEnum',
        priority: 'TaskPriority'
    },
    MaterialRequest: {
        status: 'RequestStatus',
        priority: 'TaskPriority'
    },
    MaterialReturn: {
        status: 'RequestStatus'
    },
    InventoryStore: {
        type: 'StoreTypeEnum'
    },
    InventoryTransaction: {
        type: 'TransactionTypeEnum'
    }
};

const newEnums = `
enum NotificationTypeEnum {
  SYSTEM
  EMAIL
  SMS
}

enum RequestStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
}

enum StoreTypeEnum {
  MAIN
  SUB
  VAN
}

enum TransactionTypeEnum {
  IN
  OUT
  ADJUSTMENT
}
`;
if (!updatedSchema.includes('enum NotificationTypeEnum')) {
    updatedSchema += newEnums;
}

for (let i = 1; i < models.length; i += 2) {
    const modelName = models[i];
    let modelBody = models[i + 1];

    if (enumMap[modelName]) {
        for (const [field, targetEnum] of Object.entries(enumMap[modelName])) {
            const regex = new RegExp(`(\\s+)${field}(\\s+)String(\\s+)@default\\("([^"]+)"\\)`, 'g');
            modelBody = modelBody.replace(regex, (match, p1, p2, p3, p4) => {
                return `${p1}${field}${p2}${targetEnum}${p3}@default(${p4})`;
            });
            const regex2 = new RegExp(`(\\s+)${field}(\\s+)String(\\s*\\n)`, 'g');
            modelBody = modelBody.replace(regex2, (match, p1, p2, p3) => {
                return `${p1}${field}${p2}${targetEnum}${p3}`;
            });
        }
    }
    updatedSchema += `model ${modelName} {` + modelBody;
}

fs.writeFileSync(schemaPath, updatedSchema, 'utf8');
console.log('Schema Enums updated successfully.');
