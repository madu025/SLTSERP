const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\Prasad\\.gemini\\antigravity-ide\\brain\\063cc912-81b5-4f9a-9e0d-bb324796015c\\.system_generated\\logs\\transcript_full.jsonl', 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (!line) continue;
  const parsed = JSON.parse(line);
  if (parsed.tool_calls) {
    for (const tc of parsed.tool_calls) {
      if (tc.name === 'browser_subagent' && tc.args.RecordingName === 'e2e_grn_complete') {
         console.log(`\n=== FOUND RUN: e2e_grn_complete ===`);
      }
    }
  }
  if (parsed.content && (parsed.content.includes('error') || parsed.content.includes('Error') || parsed.content.includes('failed') || parsed.content.includes('Failed'))) {
     if (parsed.step_index > 440) {
       console.log(`\n--- STEP ${parsed.step_index} (${parsed.type}) ---`);
       console.log(parsed.content.slice(0, 1000));
     }
  }
}
