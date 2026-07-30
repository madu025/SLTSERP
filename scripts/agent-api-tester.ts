import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Polyfill fetch for older Node if necessary (Node 18+ has it built-in)
// import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("FATAL: GEMINI_API_KEY is not set in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SAFE_MODE = !process.argv.includes('--danger-run-on-prod');

const SYSTEM_PROMPT = `You are an Autonomous API Testing Agent for the SLTSERP backend.
Your goal is to complete the given workflow by chaining HTTP requests to the backend API.
The base URL is ${BASE_URL}.

CRITICAL RULES:
1. You MUST ALWAYS output valid JSON matching this schema:
{
  "action": "CALL_API" | "DONE" | "ERROR",
  "method": "GET" | "POST" | "PATCH" | "DELETE",
  "path": "/api/...", 
  "body": {}, // optional JSON payload
  "message": "Reasoning for this action"
}
2. If an API returns a 400/500 error, read the message, adjust your payload, and retry.
3. Do NOT hallucinate endpoints. If you don't know the exact endpoints, start by querying common ones like /api/public/staff or /api/projects.
4. When you have achieved the goal, output {"action": "DONE", "message": "Goal achieved"}.
`;

async function runAgentLoop(goal: string) {
    console.log(`\n🤖 Starting Autonomous API Agent...`);
    console.log(`🎯 Goal: ${goal}`);
    console.log(`🛡️ SAFE_MODE: ${SAFE_MODE ? 'ON (Only GET allowed)' : 'OFF (Destructive writes enabled)'}\n`);

    const chat = model.startChat({
        history: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: `{"action":"DONE", "message":"Understood. Ready to test."}` }] }
        ],
    });

    let currentPrompt = `Goal: ${goal}. Start testing.`;
    let iteration = 0;
    const MAX_ITERATIONS = 15;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`\n--- Iteration ${iteration} ---`);
        console.log(`Thinking...`);

        try {
            const result = await chat.sendMessage(currentPrompt);
            const responseText = result.response.text();
            
            let actionData;
            try {
                actionData = JSON.parse(responseText);
            } catch (e) {
                console.error("Agent returned invalid JSON:", responseText);
                currentPrompt = `ERROR: You must return valid JSON matching the schema.`;
                continue;
            }

            console.log(`Agent: ${actionData.message}`);

            if (actionData.action === 'DONE') {
                console.log(`\n✅ Workflow Completed!`);
                break;
            }

            if (actionData.action === 'ERROR') {
                console.log(`\n❌ Agent encountered an unrecoverable error.`);
                break;
            }

            if (actionData.action === 'CALL_API') {
                const url = `${BASE_URL}${actionData.path}`;
                const method = actionData.method.toUpperCase();
                console.log(`-> Executing: ${method} ${actionData.path}`);

                if (SAFE_MODE && method !== 'GET') {
                    console.log(`⚠️ SAFE_MODE BLOCKED: ${method} request blocked.`);
                    currentPrompt = `ERROR: SAFE_MODE is ON. You can only perform GET requests. Please adjust your strategy.`;
                    continue;
                }

                if (actionData.body) {
                    console.log(`   Payload: ${JSON.stringify(actionData.body)}`);
                }

                // Execute the request
                const options: RequestInit = {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                };
                if (method !== 'GET' && actionData.body) {
                    options.body = JSON.stringify(actionData.body);
                }

                try {
                    const reqStart = Date.now();
                    const res = await fetch(url, options);
                    const isJson = res.headers.get('content-type')?.includes('application/json');
                    const resData = isJson ? await res.json() : await res.text();
                    const duration = Date.now() - reqStart;

                    console.log(`<- Response: ${res.status} (${duration}ms)`);
                    
                    // Send response back to agent
                    currentPrompt = `API Response from ${method} ${actionData.path}:\nStatus: ${res.status}\nBody: ${JSON.stringify(resData)}`;
                } catch (apiErr: any) {
                    console.error(`<- Fetch Error:`, apiErr.message);
                    currentPrompt = `Fetch Error: ${apiErr.message}. The server might be down or unreachable.`;
                }
            }
        } catch (llmErr: any) {
            console.error("LLM Error:", llmErr.message);
            break;
        }
    }

    if (iteration >= MAX_ITERATIONS) {
        console.log(`\n🛑 Reached maximum iterations (${MAX_ITERATIONS}). Aborting loop to prevent infinite run.`);
    }
}

// Check arguments
const goalArg = process.argv[2] || 'Check if the public staff endpoint is alive';
runAgentLoop(goalArg);
