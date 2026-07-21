const fs = require('fs');
const files = [
    'd:/MyProject/SLTSERP/src/app/api/banks/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/banks/[bankId]/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/banks/[bankId]/branches/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/banks/[bankId]/branches/[branchId]/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/branches/route.ts'
];

files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/'@\/lib\/apiHandler'/g, `'@/lib/api-handler'`);
    c = c.replace(/async \(\_request, params, body\)/g, `async (_request: Request, params: any, body: any)`);
    c = c.replace(/async \(\_request, _params, body\)/g, `async (_request: Request, _params: any, body: any)`);
    c = c.replace(/async \(\_request, params\)/g, `async (_request: Request, params: any)`);
    fs.writeFileSync(f, c);
});
console.log('Done');
