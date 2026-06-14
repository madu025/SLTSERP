const fs = require('fs');
const readline = require('readline');
const path = 'C:\\Users\\Prasad\\.gemini\\antigravity-ide\\brain\\a5c2629e-e4f7-4f54-886d-b7519e172420\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
    input: fs.createReadStream(path),
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT' && (line.includes('roles') || line.includes('modules') || line.includes('oldProblems'))) {
        console.log(`Step ${data.step_index} User Input (length = ${line.length}):`);
        console.log(line.substring(0, 2000));
        fs.writeFileSync(`user_input_${data.step_index}.json`, line);
        console.log(`Saved step ${data.step_index}`);
    }
});
