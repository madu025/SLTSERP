import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('tmp_feedback_v3.json', 'utf8'));
const feedback = data.feedback || {};
const outputs = feedback.outputs || {};

function findLayerDetails(dataObj: unknown, searchName: string): unknown[] {
  let found: unknown[] = [];
  if (dataObj && typeof dataObj === 'object') {
    const obj = dataObj as Record<string, unknown>;
    if (obj.name === searchName) {
      found.push(obj);
    }
    for (const key of Object.keys(obj)) {
      found = found.concat(findLayerDetails(obj[key], searchName));
    }
  }
  return found;
}

console.log('\nLayer details for SLT_Poles:');
const poles = findLayerDetails(outputs, 'SLT_Poles');
for (const p of poles) {
  console.log(JSON.stringify(p, null, 2));
}

console.log('\nLayer details for SLT_Cables:');
const cables = findLayerDetails(outputs, 'SLT_Cables');
for (const c of cables) {
  console.log(JSON.stringify(c, null, 2));
}
