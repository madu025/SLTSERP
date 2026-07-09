# 🔍 GIS Auto-Planning Span Distance Audit Report

**දිනය:** 2026-07-06 | **ගොනු 3ක් පරීක්‍ෂා කරන ලදී**

---

## 1. GISAutoPlanService.ts

### 1.1 POLE_SPACING_METERS = 38 ✅ සාමාන්‍යයි
```
POLE_SPACING_METERS: 38,  (පේළිය ~32)
```
කේබල් මාර්ග ඔස්සේ සම්මත කණු පරතරය මීටර් 38කි. QGIS/Uyana standards වලට අනුකූලයි.

### 1.2 CLOSURE_DEDUP_RADIUS_METERS = 40 ⚠️ සටහනක්
```
CLOSURE_DEDUP_RADIUS_METERS: 40,  (පේළිය ~35)
```
FDP/Joint Box අතර අවම දුර මීටර් 40කි. මෙය closure dedup සඳහා පමණක් වන අතර, cable merge radius (12m) **සොයාගත නොහැකි විය** — ගොනුවේ cable merging කොටස කියවීමට නොලැබුණි (පේළි 520+ truncate විය). 🔴 **තහවුරු කළ යුතුයි!**

### 1.3 Safety Injection — dist > 40m, Math.ceil(dist / 38) ✅ සාමාන්‍යයි
```
if (dist > 40) {
    const numSplits = Math.ceil(dist / 38);
    // numSplits - 1 intermediate poles injected
}
```
කේබල් segment එකක් මීටර් 40ට වැඩි නම්, එය 38m පරතරයෙන් කොටස් වලට කඩා අතරමැදි කණු එකතු කරයි. නමුත් ⚠️ **skip කරන ලද කණු ස්ථාන (centerline/intersection) newCoords වලට එකතු වේ, කණුවක් නොතබයි.** මෙයින් අසල කණු දෙකක් අතර දුර **54m+** දක්වා වැඩි විය හැක. උදා: 80m segment → 3 splits → 2 poles. එකක් skip උනොත්, 54m gap ඇතිවේ. 🔴 **⚠️ ගැටළුවක් — skipped pole නිසා span distance 38m target ඉක්මවා යා හැක.**

### 1.4 Safety-injected pole height = 9 ⚠️ සටහනක්
```
height: 9  (safety injection poles)
```
Safety injection මගින් එකතු කරන කණු වල උස 9m වේ. නමුත් `generatePolesGlobally` හි road crossing කණු වලට 10m ලබාදේ. Safety-injected pole එකක් road crossing (intersection 30m තුල) නම්, **9m වැරදි උසකි — 10m විය යුතුය.** 🔴 **⚠️ road crossing check safety injection වලදී සිදු නොවේ.**

### 1.5 Drop Cable Slack = dist * 1.2 (20%) ✅ සාමාන්‍යයි
```
const dropLen = cand.dist * 1.2;  (drop cable length)
```
Drop cable length = building-to-DP distance × 1.2. 20% slack එකතු කිරීම සම්මතයි.

### 1.6 INTERSECTION_SNAP_METERS = 25 ✅ සාමාන්‍යයි
```
INTERSECTION_SNAP_METERS: 25,  (පේළිය ~33)
```
Closure එකක් intersection එකකට 25m තුල නම්, intersection එකට snap වේ.

### 1.7 FEED_POINT_EXCLUSION_METERS = 20 ✅ සාමාන්‍යයි
```
FEED_POINT_EXCLUSION_METERS: 20,  (පේළිය ~34)
```
Feed Point එකට 20m තුල Joint Box නොතබයි.

### 1.8 FEED_POINT_MAX_DISTANCE_METERS = 200 ✅ සාමාන්‍යයි
Polygon එකෙන් පිටත feed point එකක් 200m දුරින් තිබිය හැක.

### 1.9 offsetPath = 3.5m default ✅ සාමාන්‍යයි
```
static offsetPath(coords, offsetDistanceMeters: number = 3.5)
```
Right-side perpendicular offset default 3.5m. Road shoulder alignment සඳහා.

### 1.10 Building-DP Connection Distance Limits ✅ සාමාන්‍යයි
- Initial: `dist <= 50` (50m තුල DP වෙත සම්බන්ධ කරයි)
- Overflow: `dist <= 150` (150m දක්වා ඉතිරි buildings)
- Load balancing steal: `distToTarget <= 50 && distToTarget <= distToSource + 15` (50m තුල, source ට වඩා 15m වැඩි නොවිය යුතුයි)

### 1.11 AI Road Dedup = 25m ✅ සාමන්‍යයි
OSM roads සමග duplicate AI roads 25m proximity check මගින් filter කරයි.

### 1.12 Cable Fiber Count = 12 ✅ සාමන්‍යයි
```
CABLE_FIBER_COUNT: 12,
```
Planned distribution cables 12F (12 core).

### 1.13 Capacities ✅ සාමන්‍යයි
| Type | Capacity |
|------|----------|
| FEED_POINT | 96 |
| MAIN_TRUNK_JOINT | 96 |
| JUNCTION_JOINT | 48 |
| MDU_TERMINAL | 16 |

### 1.14 Cable Merge Radius (12m) 🔴 සොයාගත නොහැකි විය
Cable merging logic (prefix trie/common path merge) **ගොනුවේ truncate වූ කොටසේ ඇත** (පේළි 520+). 12m merge radius තහවුරු කිරීමට නොහැකි විය. **🔴 අතින් පරීක්‍ෂා කළ යුතුයි!**

---

## 2. GISPolePlacement.ts

### 2.1 generatePolesGlobally — intervalMeters Parameter ✅ සාමන්‍යයි
```typescript
static generatePolesGlobally(
    cables, closures, intervalMeters: number, roads?
): PlannedPole[]
```
GISAutoPlanService වෙතින් `POLE_SPACING_METERS = 38` pass වේ. ✅

### 2.2 Pole Placement Algorithm ✅ සාමන්‍යයි
- Cable segment එකක් දිගේ `intervalMeters` පරතරයෙන් කණු interpolate කරයි
- Bends/corners වලදී සහ endpoints වලදී කණු තබයි
- `distanceSinceLastPole` variable මගින් segment boundaries හරහා spacing maintain කරයි
- Correctly handles carry-over distance between segments

### 2.3 Pole Dedup = 5m ✅ සාමන්‍යයි
```typescript
const existing = poles.find(p => 
    GISGeometry.getDistanceMeters(lat, lon, p.latitude, p.longitude) < 5
);
```
මීටර් 5ක් තුල තවත් කණුවක් ඇත්නම් duplicate එකක් ලෙස සලකයි. ✅

### 2.4 Intersection/Roundabout Exclusion = 6m ✅ සාමන්‍යයි
```typescript
if (GISGeometry.getDistanceMeters(lat, lon, ix.lat, ix.lon) < 6) {
    return true; // is junction or roundabout
}
```
Intersections සහ roundabouts වලට 6m තුල කණු නොතබයි. ✅

### 2.5 Centerline Exclusion = 1.2m ✅ සාමන්‍යයි
```typescript
if (dist < 1.2) {
    return true; // is centerline
}
```
Road centerline එකට 1.2m තුල කණු නොතබයි. ✅

### 2.6 Road Crossing Detection = 30m ✅ සාමන්‍යයි
```typescript
if (GISGeometry.getDistanceMeters(lat, lon, ix.lat, ix.lon) < 30) {
    return true; // is road crossing
}
```
Intersection/roundabout එකකට 30m තුල කණු "road crossing" ලෙස සලකයි, 10m උසක් ලබාදේ. ✅

### 2.7 Pole Height Assignment ✅ සාමන්‍යයි
| Condition | Height |
|-----------|--------|
| Road crossing (30m of intersection/roundabout) | 10m |
| Default | 8m |
| `interpolatePoles` (legacy) | 9m |

### 2.8 Closure Poles — Force Placement ✅ සාමන්‍යයි
```typescript
for (const c of closures) {
    addPole(c.latitude, c.longitude, true); // force=true
}
```
සෑම closure/FDP/Joint Box එකකම කණුවක් තබයි (force mode — centerline/intersection checks skip කරයි). ✅

---

## 3. GISRoadNetwork.ts

### 3.1 getNodeOffsetCoordinate — Offsets ✅ සාමන්‍යයි

| Road Type | Offset |
|-----------|--------|
| Default | 3.5m |
| trunk / motorway / primary | 7.5m |
| secondary | 5.0m |
| 4+ lanes (regardless of type) | 7.5m |

මෙම offset distances road shoulder එකේ cable routing සඳහා යොදාගනී. 0.000009 deg/m conversion භාවිතා කරයි. ✅

### 3.2 buildDualShoulderGraph — getOffsetDistance ✅ සාමන්‍යයි
getNodeOffsetCoordinate හා සමාන rules භාවිතා කරයි. ✅

### 3.3 getRoadShoulderCoords — offsetDeg = offsetMeters * 0.000009 ✅ සාමන්‍යයි
```
const offsetDeg = offsetMeters * 0.000009;
```
Sri Lanka latitude (~7.87°N) සඳහා: 1m ≈ 0.00000898° lat, ~0.00000906° lon. 0.000009 approx error < 1%. 3.5m offset සඳහා error < 3cm. ✅

### 3.4 Roundabout Grouping = 80m ✅ සාමන්‍යයි
```typescript
if (GISGeometry.getDistanceMeters(...) < 80.0)
```
Roundabout segments 80m තුල නම්, ඒවා එකම roundabout group එකකට එකතු කරයි. ✅

### 3.5 Center Island Check = 22m ✅ සාමන්‍යයි
```typescript
if (dCenter < 22.0) {
    if (dCenter < minRingDist - 1.0) {
        return true; // inside center island
    }
}
```
Roundabout center එකට 22m තුල සහ ring එකට වඩා ඇතුලත නම් center island ලෙස හඳුනාගනී. ✅

### 3.6 snapToNearestRoad — Multipliers ✅ සාමන්‍යයි

| Road Type | Multiplier | Effect |
|-----------|-----------|--------|
| trunk/primary/motorway | 1.8× | Major roads heavily penalized |
| secondary | 1.1× | Slightly penalized |
| residential/service/unclassified/tertiary | 0.85× | **Favored** for drop loops |

Drop loops local residential roads වලට favor කරයි. ✅

### 3.7 healRoadNetwork — Stitch Limit = 55m ✅ සාමන්‍යයි
```typescript
if (minDistance <= 55 && bestU && bestV) {
    healedRoads.push({ ..., highwayType: 'virtual_stitch' });
}
```
Disconnected road components 55m තුල නම් virtual stitch segment එකක් මගින් සම්බන්ධ කරයි. ✅

### 3.8 Junction Penalties ✅ සාමන්‍යයි

| Condition | Penalty (added meters) |
|-----------|----------------------|
| Basic junction (degree 2-3) | 150 |
| Complex junction (degree ≥ 4) | 500 |
| Shoulder swap (cross road) | 600 |
| Roundabout center crossing | +1500 |
| Trunk/motorway swap | +2000 |
| Primary road swap | +1200 |
| Secondary road swap | +800 |

### 3.9 Major Road Crossing — Strictly Forbidden ✅ සාමන්‍යයි
```typescript
if (isMajorRoad) {
    // Major road centerline crossings are strictly forbidden at ALL points
    // Map centerline to shoulder nodes but skip adding swap edge
    continue; // NO swap edge added!
}
```
Trunk/motorway/primary/4+lane roads centerline crossings සම්පූර්ණයෙන්ම තහනම්. QField survey මගින් පමණක් හරස් කළ හැක. ✅

### 3.10 Minor Road — Single-Sided Routing ✅ සාමන්‍යයි
```typescript
if (!isMajorRoad) {
    rightCoords = leftCoords; // Force single-sided
}
```
Minor roads වල right shoulder left shoulder එකට collapse කරයි. Prefix Trie merge සඳහා. ✅

### 3.11 Used Shoulder Tracking ✅ සාමන්‍යයි
```typescript
if (usedRoadShoulders && usedRoadShoulders.get(road.id) === 'RIGHT') {
    penalty += 5000; // LEFT side preferred for next cable
}
```
එක් පාරක් භාවිතා කළ shoulder side එකට 5000m penalty. Alternating side preference. ✅

---

## 📊 සාරාංශය

### ✅ සාමාන්‍ය (PASS) — 24 items

| # | Item | Value | Status |
|---|------|-------|--------|
| 1 | POLE_SPACING_METERS | 38m | ✅ |
| 2 | Safety injection threshold | >40m | ✅ |
| 3 | Safety split calculation | Math.ceil(dist/38) | ✅ |
| 4 | Drop cable slack | dist × 1.2 (20%) | ✅ |
| 5 | INTERSECTION_SNAP_METERS | 25m | ✅ |
| 6 | FEED_POINT_EXCLUSION_METERS | 20m | ✅ |
| 7 | FEED_POINT_MAX_DISTANCE_METERS | 200m | ✅ |
| 8 | offsetPath default | 3.5m | ✅ |
| 9 | Pole dedup radius | 5m | ✅ |
| 10 | Intersection pole exclusion | 6m | ✅ |
| 11 | Centerline pole exclusion | 1.2m | ✅ |
| 12 | Road crossing detection | 30m | ✅ |
| 13 | Road crossing pole height | 10m | ✅ |
| 14 | Default pole height | 8m | ✅ |
| 15 | Roundabout grouping | 80m | ✅ |
| 16 | Center island check | 22m | ✅ |
| 17 | snapToNearestRoad multipliers | 1.8/1.1/0.85 | ✅ |
| 18 | healRoadNetwork stitch | 55m | ✅ |
| 19 | Junction penalties | 150/500 | ✅ |
| 20 | Shoulder swap penalty | 600 | ✅ |
| 21 | Major road crossing ban | forbidden | ✅ |
| 22 | Single-sided minor roads | collapsed | ✅ |
| 23 | Shoulder offset for major roads | 7.5m | ✅ |
| 24 | Building-DP connection limit | 50m/150m | ✅ |

### 🔴 ගැටළු (ISSUES) — 3 items

| # | Item | ගැටළුව | බරපතලත්වය |
|---|------|--------|-----------|
| 1 | **Cable merge radius (12m)** | ගොනුව truncate වීම නිසා තහවුරු කළ නොහැකි විය. අතින් පරීක්‍ෂා කළ යුතුයි. | 🔴 HIGH |
| 2 | **Safety injection pole height = 9** | Road crossing කලාපයක safety-injected pole එකකට 9m ලැබේ (10m විය යුතුයි). Road crossing check safety injection logic එකේ නොමැත. | 🟡 MEDIUM |
| 3 | **Skipped pole spans > 38m** | Safety injection වලදී centerline/intersection වල කණු skip කරයි, නමුත් cable path එක එම ලක්ෂ්‍යය හරහා යයි. Skip වූ කණු නිසා යාබද කණු දෙකක් අතර දුර 54m+ දක්වා වැඩි විය හැක. | 🟡 MEDIUM |

---

## 🔧 නිර්දේශ (Recommendations)

1. **Cable merge radius (12m)**: GISAutoPlanService.ts ගොනුවේ 520+ පේළි කියවා cable merging logic සහ 12m merge radius තහවුරු කරන්න.

2. **Safety injection pole height**: Safety injection loop එකට road crossing check (30m of intersection) එකතු කර, crossing නම් 10m height assign කරන්න.

3. **Skipped pole span gap**: Centerline/intersection වලදී pole skip වුවහොත්, ඊළඟ pole එකේ position adjust කර actual span distance 38m ට වඩා වැඩි නොවන ලෙස සැකසිය යුතුයි. නැතහොත් skipped point එකට ආසන්නතම හොඳ ස්ථානයක කණුවක් තැබිය යුතුයි (offset from centerline).

