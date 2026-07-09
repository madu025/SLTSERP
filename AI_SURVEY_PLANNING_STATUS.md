# SLTSERP - AI survey & FTTH Planning Status & Implementation Plan

This document serves as a persistent record of the work completed on the GIS & FTTH Auto-Planner module, the issues identified during testing, and the concrete implementation plan to resolve them. **Keep this file in the workspace root so it survives PC restarts.**

---

## 📅 Summary of Completed Work

1. **GIS Data Ingestion Repair:**
   * Ingested the missing 37 existing poles for project `FSSD_SLTS_2026_002` (`SM-HJJ-0508-AB`) in the database. The project now renders all **39 poles** successfully.
   * Built a filename and properties auto-resolver (`checkIsExisting` in `GISImportService.ts`) to automatically set status to `VERIFIED`/`INSTALLED` for existing assets and `PLANNED` for newly proposed assets.

2. **Aesthetic Map Labeling:**
   * Displaying real QGIS names (e.g. `DP-1`, `FJ-2`) next to FDP/Joint icons on the map using OpenLayers `Text` styles.

3. **🤖 AI Auto-Planner & Dijkstra Routing:**
   * Added a polygon Draw interaction to snoop streets/buildings in the selected area.
   * Upgraded cable path calculations to route along actual streets using **Dijkstra's shortest path graph algorithm** over OSM road networks.
   * Auto-interpolates poles at 35-40m spans.
   * Added **Interactive Re-routing (Drag-and-Drop)**: Dragging FDP/Joint closures triggers dynamic path recalculation and relocates poles. Dragging poles updates coordinates locally.
   * **BBox Fallback**: Pre-saved routes calculate a bounding box to support drag-and-drop translations even if no polygon was drawn.

4. **💰 Auto-BOQ Calculations:**
   * Saving an AI planned route triggers `completeSurveyAndGenerateBOQ` to auto-calculate poles, splice closures, cables, and chamber counts, instantly updating the project's estimated budget.

---

## ⚠️ Identified Issues / Shortcomings (Why it is not fully working yet)

1. **Overpass API Rate Limiting (Too Many Requests):**
   * **Problem**: The public OpenStreetMap Overpass interpreter (`https://overpass-api.de/api/interpreter`) has aggressive rate limits. When multiple requests are sent, it returns `429 Too Many Requests` or times out. This makes the Draw tool return "Failed to generate layout" errors.
   * **Solution**: Implement a graceful fallback inside `GISAutoPlanService.ts`. If Overpass is rate-limited or fails, mock virtual roads along the perimeter of the drawn polygon, cluster buildings based on raw coordinate bounding boxes, and route cables along the virtual boundary.

2. **Conversation History Loss (PC Restart):**
   * **Problem**: If the PC is restarted, browser sessions and AI conversation context might be reset.
   * **Solution**: This document (`AI_SURVEY_PLANNING_STATUS.md`) preserves the exact roadmap so any future AI agent can read it and pick up from where we left off.

---

## 🚀 Implementation Plan to Resolve Remaining Issues

### Phase A: Graceful Overpass API Fallback
* [ ] **Modify `GISAutoPlanService.generatePlan`**: Wrap the Overpass network call in a try-catch. If it fails, trigger `generateFallbackPlan`.
* [ ] **Implement `generateFallbackPlan`**:
  * If no OSM roads are available, treat the vertices of the drawn polygon as the road network (virtual roads).
  * Snap any detected buildings or click points to the nearest polygon edge.
  * Construct a simple loop cable routing along the polygon boundary lines.

### Phase B: Splitter Ratio Selector UI
* [ ] **Add UI Control**: Add a dropdown selector for Splitter Ratio (e.g. `1:8`, `1:16`, `1:4`) in the GISMapView Auto-Plan floating panel.
* [ ] **Pass Ratio to API**: Send the selected ratio in the `/api/gis/auto-plan` request body.
* [ ] **Recalculate Centroids**: Adjust the clustering algorithm to group homes based on the selected maximum splitter ratio.

### Phase C: Manual Slack & Tension Loop Placement
* [ ] **Add Slack Action**: Allow clicking a planned pole/span and selecting "Add Tension Slack Loop" (+20m extra cable length).
* [ ] **Update BOQ**: Instantly update the cable length metadata and regenerate the draft BOQ amount.

---

## 📖 Instructions for Next AI Session (After PC Restart)
If the conversation history is lost:
1. Open this file: `AI_SURVEY_PLANNING_STATUS.md`.
2. Look at the **"Implementation Plan to Resolve Remaining Issues"** above.
3. Start executing **Phase A: Graceful Overpass API Fallback** to ensure the drawing tool works reliably even when the Overpass API is rate-limited.
4. Verify by running `npx tsc --noEmit` to ensure type safety.
