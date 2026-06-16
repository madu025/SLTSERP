# SLTSERP Agent Instructions

## Communication Mandate (STRICT)

To conserve tokens and maintain professional efficiency, all AI responses MUST:

1.  **NO EMOJIS**: Do not use emojis anywhere (e.g., ✅, 🚩, 🏁).
2.  **NO FLAGS**: Do not use flag characters or strings of flags (e.g., 🏁, 🚩).
3.  **NO REPEATING CHARACTERS**: Do not repeat characters for decoration (e.g., "=====", "🏁🏁🏁").
4.  **EXTREME CONCISENESS**: Provide direct technical answers. Avoid greetings, fluff, and unnecessary apologies.
5.  **NO SUMMARIES**: Only provide a summary if explicitly requested.
6.  **ZERO FLUFF**: Respond as a senior engineer to a senior engineer.
7.  **NO REPETITIVE STATUS CHECKING**: Do NOT call `command_status` repeatedly with the same ID without significant new output or clear manual request. NEVER start an autonomous "checking loop" that repeats more than 2 times. If output still shows the same, inform the user and stop.

FAILURE TO FOLLOW THESE RULES WASTES USER TOKENS AND MONEY. STOP IMMEDIATELY.

## Codebase Context & Domain Rules
Before making any changes:
1. Read the comprehensive development guidelines and architecture map in the SLTSERP Development Workflow skill: [SKILL.md](file:///d:/MyProject/SLTSERP/.agent/skills/development-workflow/SKILL.md).
2. Pay close attention to **Material Sourcing**: `SLT Sourced` (deducted from our invoice by SLT monthly) vs. `SLTS Sourced` (our own inventory issued to contractors).
3. Handle new tables/models (like `Penalty`) using **`primaryClient`** directly from `src/lib/prisma` inside transactions and write operations to avoid extended client type-resolution bugs in IDEs/compilers.

