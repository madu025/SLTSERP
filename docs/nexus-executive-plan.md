# Nexus Executive Assistant: role discussion and development plan

Scope: items 1 to 8 of the executive roadmap (brief, comparison, drivers, anomalies, forecast, drill-down, cross-module profiles, export).
Fixed rules for every item: the external model never sees ERP data (plan-only mode); each tool checks a canonical permission and the caller's OPMC scope; no new hard-coded role lists; numbers are computed on our server from the database.

## 1. Discussion between ten management roles

Each role was asked: what do you ask every week, what decision follows, and what must this never do.

| # | Role | Questions they ask (Singlish) | Decision it drives | Must never |
|---|---|---|---|---|
| 1 | CEO | "Company eka kohomada?", "Mase profit pahuwa masayata wada da?", "Mokada hari awulak thiyenawada?" | Where to intervene this week | Bury the headline in tables; show stale numbers without a date |
| 2 | CFO | "Cash kiyada?", "AR 60 days ඉක්මවපු ගාන?", "Revenue yanawada target ekata?", "Mase avasanayata profit?" | Collections, spending, funding | Mix GL and sub-ledger figures; show unreconciled totals without a warning |
| 3 | COO (service delivery) | "Open orders kiyada, kochchara 30 days walata wada?", "SLA % mokada?", "Return wadi RTOM mokakda?" | Staffing, backlog clearing | Hide which RTOM drives a total |
| 4 | Area manager | "Mage OPMC eke return/pending kiyada?", "Mage contractors la monawada karanne?" | Daily follow-up | Show other areas' data; show company-wide numbers as if they were local |
| 5 | Head of projects (PMO) | "Late/over-budget projects mokada?", "Budget use %?" | Escalation, re-planning | Report a project healthy when it has no budget or end date |
| 6 | Head of procurement | "Late POs?", "Vendor spend top?", "Committed amount?" | Vendor follow-up, cash planning | Show prices to users without cost capability |
| 7 | Stores / inventory manager | "Low stock?", "Dead stock?", "Contractor kenekge stock kiyada?" | Replenishment, transfers | Suggest a transfer that the server cannot validate |
| 8 | Contractor management | "Weak contractors?", "Contractor X: orders, stock, invoice, wastage" | Contract action, payment holds | Rank contractors with thin volume as if comparable |
| 9 | Internal audit / controls | "Breaches?", "Self-approved payments?", "Who saw what?" | Investigations | Answers without an audit trail; answers that cannot be reproduced |
| 10 | IT / data owner | "Data keeps inside?", "Who can ask what?", "Cost per question?" | Risk acceptance | Any ERP data leaving the system; permission shortcuts |

### Where the roles agree
- A one-screen answer first, detail on demand (CEO, CFO, COO, GM).
- Every figure carries its period and its "as of" time (CFO, audit).
- Comparison with the previous period is the default, never a bare number (CEO, CFO, COO).
- Export for meetings: Excel for finance, PDF for the board (CFO, CEO).

### Where they disagree, and the decision taken
| Conflict | Decision |
|---|---|
| CEO wants company-wide, area managers must see only their OPMC | One brief tool, two scopes: company-wide only for users the existing health endpoint already allows; everyone else gets the same shape limited to their OPMC scope |
| COO wants "why" explanations, IT forbids sending data to the model | "Why" is computed on our server (top movers), shown as a table and cards; the model only routes the question |
| Audit wants reproducibility, CEO wants speed | Every answer shows the period and filters used; heavy results are cached (2 min fresh, 15 min stale) and labelled with the as-of time |
| CFO wants forecasts, nobody has targets in the system | Forecast starts as run-rate and prior-period projection, clearly labelled "projection"; targets become a later table once the CFO confirms the numbers |
| Stores wants one-click transfers | Not in this plan. Existing server-validated stock actions stay as they are |

## 2. Requirements that came out of the discussion

R1 One brief answers "how is the company doing" with deltas and the top attention items.
R2 Any supported metric can be compared across periods, optionally grouped by RTOM, contractor or item.
R3 A drivers view shows which groups contributed most to a change.
R4 Anomalies are found by fixed rules plus statistics, each with a reason and a link to the data.
R5 Projections for month end and trend, labelled as projections.
R6 Every table row and chart bar can lead to the next level (drill-down).
R7 Profiles bring several modules together for one contractor, RTOM or project.
R8 Excel and PDF export of the brief and of any table or comparison.
R9 Permission and OPMC scope enforced per section, and sections the user cannot see are left out, never shown empty.
R10 Every answer carries period, filters, and as-of time.

## 3. Architecture shared by items 1 to 8

- `ExecutiveMetricService`: a registry of metrics (id, label, unit, source, "higher is better" flag, required permission, scopable yes/no). Metrics for phase A: completed orders, new orders, open orders, returns, SLA %, revenue, expense, net profit, receivables, payables.
- `PeriodService`: turns "this month", "last 30 days", "this week" and "vs previous" into exact UTC ranges, with the same-days comparison rule the health view already uses.
- New assistant tools (model picks a tool, we run it): `getExecutiveBrief`, `compareMetric`, `explainChange`, later `findAnomalies`, `projectMetric`, `getProfile`, `exportResult`.
- Result shape: `cards` (with delta and direction), `table`, `chart`, plus `meta` (period, comparison period, filters, as-of). The chat UI renders them; delta cards show up/down with colour and an icon, never colour alone.
- Cache: `swrMemo` keyed by user, permissions and arguments.
- Safety: a section needs its module permission; scoped users get scoped queries or no section.

## 4. Development plan

| Phase | Items | Deliverable | Done when |
|---|---|---|---|
| A | 1, 2 | Executive brief and metric comparison, delta cards | 30 golden questions pass in a real browser; scoped user sees only own OPMC |
| B | 3, 4 | Drivers (top movers) and anomaly list | Each anomaly rule has a test with a fixture; no false alert on a quiet month |
| C | 5 | Month-end and trend projections | Back-test on last 6 months shows the error range |
| D | 6, 7 | Drill-down buttons and contractor / RTOM / project profiles | Every drill-down returns the same total as its parent row |
| E | 8 | Excel and PDF export of brief, table, comparison | Opened in Excel and a PDF viewer; numbers equal the screen |

Every phase ends with: unit tests, `pnpm exec tsc --noEmit -p .`, ESLint on changed files, a clean `pnpm run build`, a browser test through the assistant chat on localhost, push, then a check on production after deploy.

## 5. Evaluation set (written before the code)

Per role, five questions with the tool and the scope expected. Example rows:

| Role | Question | Expected tool | Expected check |
|---|---|---|---|
| CEO | company eka kohomada | getExecutiveBrief | cards for revenue, profit, cash, open orders, each with a delta |
| CFO | mase revenue pahuwa masa ekka | compareMetric | revenue current vs previous, same days of the month |
| COO | return wadi RTOM mokakda | explainChange | table ranked by contribution |
| Area manager | mage OPMC eke open orders | getExecutiveBrief (scoped) | numbers equal the scoped dashboard |
| Audit | breaches this month vs last | compareMetric | only with the control capability |
| IT | (any question) | any | request log shows no ERP values sent to the model |

## 6. Risks and what we do about them

| Risk | Control |
|---|---|
| Metric defined differently from the dashboard | The registry reuses the dashboard services wherever they exist; a test compares both |
| Slow brief (many queries) | Parallel sections with the bounded concurrency already used, plus cache |
| Misleading comparison (a half-finished month vs a full month) | Same-days rule from `monthBounds`, shown in the card caption |
| Over-trust in projections | Labelled "projection", with the method in the caption |
| Scope leaks | Tests with a scoped user for every tool |
