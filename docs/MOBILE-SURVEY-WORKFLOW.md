# SLTSERP Mobile Survey Workflow

> Complete guide for supervisor mobile survey using QField + QFieldCloud

---

## Step 1: Web Portal → Project Create + Supervisor Assign

Manager/AE web portal එකෙන්:
1. Create Project (name, code, route, budget)
2. Assign Supervisor: `POST /api/projects/:id/supervisors`
3. Project status auto-updates: `PLANNING → SURVEY_IN_PROGRESS`

---

## Step 2: Start QFieldCloud Server (IT/Admin - once)

```bash
cd docker/qfieldcloud
docker compose -f docker-compose.qfield.yml up -d
```

Verify services:
- `http://localhost:8100/api/v1/status/` — QFieldCloud API
- `http://localhost:9001` — MinIO Storage Console

Then push project to QFieldCloud:
```
POST /api/projects/:id/qfield-sync { action: "create_project" }
→ Creates QFieldCloud project + pushes 12 survey layers
```

---

## Step 3: Create QFieldCloud Project (Auto via API)

```
POST /api/projects/:id/qfield-sync
Body: { "action": "create_project", "qgisTemplate": "QGIS Project Template/QGIS.qgz" }

Response:
{
  "qfieldProject": { "id": "qfield-abc-123" },
  "layersCount": 12
}
```

---

## Step 4: Supervisor Opens QField Mobile App

1. Install **QField** from Play Store / App Store
2. Open → "Cloud Projects"
3. Enter server URL:
   - Local: `http://YOUR_LAN_IP:8100`
   - Remote: `http://SERVER_IP:8100`
4. Login with QFieldCloud credentials

---

## Step 5: Download Project + Start Survey

1. Select project from cloud list
2. "Download Project" → 12 layers + QGIS template download
3. Map view opens → all 12 layers visible
4. GPS auto-tracks current location

---

## Step 6: Mark Survey Points on Map

Tap map → Select layer → Fill form → Save:

| # | Layer | Icon | Color | Material |
|---|-------|------|-------|----------|
| 1 | Existing Pole | 🌳 | Green | Labor only |
| 2 | New Pole | 🔩 | Red | Full material |
| 3 | Joint Closure | 🔗 | Blue | Material+Labor |
| 4 | Enclosure/ODF | 📦 | Purple | Material+Labor |
| 5 | Cable Start (A-End) | 🅰️ | Amber | Cable |
| 6 | Cable End (B-End) | 🅱️ | Orange | Cable |
| 7 | Cable Mid-Point | ➖ | Yellow | Cable |
| 8 | FDP Point | 📍 | Cyan | Material |
| 9 | Chamber | 🕳️ | Brown | Material+Labor |
| 10 | DP Location | 🔀 | Pink | Route change |
| 11 | Road Crossing | 🛣️ | Slate | Labor only |
| 12 | Obstruction | ⚠️ | Red | Misc |

---

## Step 7: Multi-Day Continue Survey

Day 1: Mark 50 points → Close app (auto-saved offline)
Day 2: Open app → Same project → Previous 50 points visible → Continue

API: `POST /api/projects/:id/survey/sessions { action: "continue", sessionId }`

---

## Step 8: DP Location (Route Changes)

When route needs to diverge:
1. Select layer: "DP Location" (🔀 Pink)
2. Mark DP point
3. Fill: dp_number, route_change_reason, new_route_description, distance_from_main

---

## Step 9: Sync Survey Data

Mobile App: Menu → "Sync Project"

Web Portal: `POST /api/projects/:id/qfield-sync { action: "full_sync" }`

---

## Step 10: Web Portal Approval + BOQ

1. Points appear in `ProjectSurveyApproval.tsx`
2. Verify → Approve (batch approve available)
3. `POST /boq/generate` → Auto-BOQ with telecom cable rules
4. `POST /boq/approve` → Submit → Approve → Budget set
5. `POST /boq/generate-pr` → Auto Material Request

---

## Data Flow

```
QField App (iOS/Android)
  ↓ WiFi/Mobile Data
QFieldCloud Server (Docker, port 8100)
  ↓ Delta API pull
SLTSERP (Next.js, port 3000)
  ↓ Prisma
PostgreSQL (SurveyPoint table)
  ↓
Web Portal → View/Approve/BOQ
```

---

## Setup Checklist (Per Project)

| Task | Who | Time |
|------|-----|------|
| Start QFieldCloud Docker | IT | 2 min |
| Create project + assign supervisor | Manager | 5 min |
| Create QFieldCloud project (API) | Auto | 30 sec |
| Install QField app | Supervisor | 5 min |
| Login + download project | Supervisor | 2 min |
| **Total** | | **~15 min** |