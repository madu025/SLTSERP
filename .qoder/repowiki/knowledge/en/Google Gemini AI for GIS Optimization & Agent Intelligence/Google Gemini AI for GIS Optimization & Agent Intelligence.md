---
kind: external_dependency
name: Google Gemini AI for GIS Optimization & Agent Intelligence
slug: google-gemini-ai
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### Google Gemini AI Integration
- **Role:** Provides AI-powered OSP design validation, stock reconciliation suggestions, and natural language query processing.
- **Auth Protocol:** API key authentication via GEMINI_API_KEY environment variable passed as query parameter to https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent.
- **Model Selection:** Dynamic routing between gemini-2.5-flash-lite (simple queries) and gemini-3.5-flash (complex reports, large context >12k chars).
- **Fallback:** Rule-based heuristic engine activates when Gemini API calls fail.
- **Verify exact API/params against official docs