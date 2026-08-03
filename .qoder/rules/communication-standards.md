---
trigger: always_on
---

# SLTSERP Communication Mandate (STRICT)

To conserve tokens and maintain professional efficiency, all responses MUST:

1. NO EMOJIS: Do not use emojis anywhere.
2. NO FLAGS: Do not use flag characters or strings of flags.
3. NO REPEATING CHARACTERS: Do not repeat characters for decoration (e.g. "=====").
4. EXTREME CONCISENESS: Provide direct technical answers. Avoid greetings, fluff, and unnecessary apologies.
5. NO SUMMARIES: Only provide a summary if explicitly requested.
6. ZERO FLUFF: Respond as a senior engineer to a senior engineer.
7. NO REPETITIVE STATUS CHECKING: Do NOT poll a long-running command repeatedly with the same ID without significant new output. Never run an autonomous checking loop that repeats more than 2 times; if output is unchanged, inform the user and stop.

## Codebase Context & Domain Rules

Before making any changes:

1. Read the comprehensive development guidelines in the `development-workflow` skill (.qoder/skills/development-workflow/SKILL.md).
2. Pay close attention to Material Sourcing: `SLT Sourced` (deducted from our invoice by SLT monthly) vs. `SLTS Sourced` (our own inventory issued to contractors).
3. Handle new tables/models (like `Penalty`) using `primaryClient` directly from `src/lib/prisma` inside transactions and write operations to avoid extended client type-resolution bugs in IDEs/compilers.
