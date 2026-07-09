# 🌳 Prefix Trie SPT Routing — Comprehensive Tree Branching Audit

**ගොනුව:** `GISAutoPlanService.ts` | **පරීක්‍ෂිත පේළි:** 709–1145 | **දිනය:** 2026-07-06

---

## 📐 Prefix Trie Architecture (පේළි 709–815)

### ක්‍රියාකාරීත්වය:
```
Feed Point → Dijkstra SPT → DP₁, DP₂, DP₃, ...
                     ↓
              Prefix Trie Merge
                     ↓
            traverseTrie → Cables + Junctions
```

සියලුම DP paths (Dijkstra shortest paths) Feed Point එකෙන් ගෙන, ඒවා Prefix Trie එකක merge කර, shared segments හඳුනාගෙන, branch points වල Junction Joint Boxes තබයි.

---

## 🔍 පරීක්‍ෂණ 7 — සවිස්තර සොයාගැනීම්

### 1️⃣ Prefix Trie Shared Path Reuse ✅ අර්ධ වශයෙන් නිවැරදියි

**Exact-match merge පමණක් සිදු කරයි:**

```typescript
const coordToHash = (pt: [number, number]): string => {
    return `${pt[0].toFixed(6)},${pt[1].toFixed(6)}`;  // පේළිය 724
};
```

| අංශය | තත්වය | විස්තරය |
|-------|--------|---------|
| Exact match reuse | ✅ | එකම coordinate හරහා යන paths share කරයි |
| Direction awareness | ✅ | Dijkstra paths සියල්ල feed point → DP දිශාවටම බැවින් reverse order ගැටළු නැත |
| Tolerance matching | 🔴 | Coordinates **සම්පූර්ණයෙන්ම සමාන විය යුතුයි** |

**🔴 ගැටළුව #1.1: Tolerance-less Matching (Spatial Hash Sensitivity)**

Paths දෙකක් එකම පාරේ 5m දුරින් diverge වුවහොත් **Trie merge නොවේ**. උදාහරණ:

```
Path₁: A→B→C₁→DP₁  (C₁ at lon=79.861234)
Path₂: A→B→C₂→DP₂  (C₂ at lon=79.861289, 5m apart from C₁)
```

`toFixed(6)` precision (~0.11m) නිසා, 5m වෙනසක් නම් hash(80.861234,?) ≠ hash(80.861289,?). Trie එක merge නොවේ. **A→B කොටස share වුවත් C₁/C₂ ළඟදී වෙන් වේ.** Parallel cables දෙකක් එකම පාරේ දිවෙයි — කේබල් නාස්තිය!

**විසඳුම:** `coordToHash` වෙනුවට spatial proximity lookup (0.5m-1m tolerance) හෝ snapped road-segment ID based key.

---

### 2️⃣ Branch Point Positioning 🟡 Suboptimal

Branch point = Trie node with `children.size >= 2`.

```typescript
if (node.children.size >= 2) {
    // Branch point → Place Junction Joint
    plannedClosures.push({
        latitude: node.pt[1],
        longitude: node.pt[0],  // ← Exact divergence coordinate
        ...
    });
}
```

| අංශය | තත්වය |
|-------|--------|
| Branch detection | ✅ නිවැරදියි |
| Junction placement | 🟡 Suboptimal |

**🟡 ගැටළුව #2.1: Branch Point = Exact Divergence Coordinate**

Branch point එක divergence වන exact coordinate එකේම තබයි. මෙය optimal නොවේ. Real-world road network එකක, optimal branch point එක divergence point එකට වඩා slightly before (trunk දිගේ) හෝ road intersection edge එකේ තිබිය යුතුයි.

**🟡 ගැටළුව #2.2: No "Short Trunk Extension" Optimization**

Branch node එකට ළඟා වීමට පෙර, shared trunk එකේ අවසාන coordinate එකත් branch point එකත් අතර ඇත්තේ 0m distance (exact same point). Shared trunk එක branch point එකට පෙර terminate වන අතර, branch cables branch point එකෙන් ආරම්භ වේ. මෙය **correct** නමුත්, branch point එකෙන් පසුව එන cable segment එකක් ඉතා කෙටි (<10m) නම්, එය අනවශ්‍ය junction joint එකක් නිර්මාණය කරයි.

---

### 3️⃣ traverseTrie Cable Split Logic ✅ නිවැරදියි (1 exception සමග)

```typescript
const traverseTrie = (node, currentCableCoords, isTrunk) => {
    currentCableCoords.push(node.pt);
    
    if (node.children.size === 0) {
        // Leaf → End cable  ✅
    } else if (node.children.size === 1) {
        // Single child → Continue same cable  ✅
    } else {
        // Branch (≥2 children) → Terminate + New cables each  ✅
        // Place junction joint if eligible
        for (const child of node.children.values()) {
            traverseTrie(child, [node.pt], false);  // Fresh cable starting at branch
        }
    }
};
```

| අංශය | තත්වය |
|-------|--------|
| Single-path continuation | ✅ නිවැරදියි |
| Leaf termination | ✅ නිවැරදියි |
| Branch splitting | ✅ නිවැරදියි |
| Branch cables start at branch pt | ✅ නිවැරදියි |

**🔴 ගැටළුව #3.1: Root-level `isTrunk` flag propagation**

```typescript
const isOLTStart = startDeviceType === undefined || String(startDeviceType).toUpperCase() === 'OLT';
for (const child of root.children.values()) {
    traverseTrie(child, [root.pt], isOLTStart);  // පේළිය 812
}
```

Root ළඟ `isTrunk = isOLTStart`. Branch වලදී: `traverseTrie(child, [node.pt], false)`. Trunk flag ✅ **නිවැරදිව** branch වලදී false වේ. Distribution cables 12F, trunk 48F.

**🔴 ගැටළුව #3.2: Single-child chain එකේ අනවශ්‍ය දිගු කේබල්**

`node.children.size === 1` chain එකක් දිගේ cable එක interrupt නොවී continue වේ. නමුත් මෙම chain එක **ඉතා දිගු (>500m)** වුවහොත්, cable drum limit ඉක්මවා යා හැක. Cable drum size check **නොමැත**. (Practical concern — field installation වලදී 500m-1000m limit ඇත.)

---

### 4️⃣ Suboptimal Sequential Paths → Tree Branching Gaps 🔴🔴 CRITICAL

**මෙය වඩාත් බරපතල ගැටළුවයි!**

#### 🔴🔴 ගැටළුව #4.1: Minimum Steiner Tree වෙනුවට Independent Dijkstra Merge

| Approach | Cable Length | Complexity |
|----------|-------------|------------|
| **Current:** Independent Dijkstra paths → Prefix Trie merge | Suboptimal (10-30% waste) | O(V log V) per DP |
| **Optimal:** Minimum Steiner Tree (MST on DP terminals) | Optimal | NP-Hard |
| **Practical:** Iterative shared trunk optimization | Near-optimal | O(N²) reasonable |

**උදාහරණය (Worst Case):**

```
Road Network:
    A ──── B ──── C ──── DP₁
    │                   │
    └─── X ──── Y ──── DP₂

Dijkstra shortest paths:
  DP₁: A→B→C→DP₁   (distance: 300m)
  DP₂: A→X→Y→DP₂   (distance: 300m)
```

Prefix Trie merge: **Shared prefix = {A} only!** → Total cable = 600m

Better tree (Steiner): Route A→B→C→DP₁ + branch from C to DP₂ (if path exists), හෝ A→B→(branch)→C→DP₁ and B→D→DP₂. 

**Current algorithm කිසිදු global optimization කරන්නේ නැත.** එක් එක් DP සඳහා **ස්වාධීන** shortest path ගෙන, post-hoc merge කරයි. මෙය tree branching වලට වඩා cable length 10-30% වැඩි කරයි!

#### 🔴🔴 ගැටළුව #4.2: Parallel Cable Duplication

Dijkstra paths දෙකක් **එකම පාරේ** parallel ලෙස ගමන් කළත්, coordinates slightly different නම් (different shoulder side, GPS drift), Trie merge නොවේ. Result: **එකම පාරේ cables 2ක්.**

#### 🟡 ගැටළුව #4.3: No "Re-route Through Existing Trunk" Logic

Trunk cable එකක් දැනටමත් C coordinate එක හරහා යනවා නම්, නව DP path එකක් C වෙත re-route කර share කිරීමේ logic නොමැත. Path merge post-hoc පමණි.

---

### 5️⃣ coordToHash Precision ✅ නිවැරදියි (consistency check සමග)

```typescript
coordToHash: toFixed(6) → ~0.11m precision  (පේළිය 724)
poleMergeMap key: toFixed(6)               (පේළි 850, 856)
greedy aggregation key: toFixed(6)         (පේළි 977)
```

| අංශය | තත්වය |
|-------|--------|
| Precision (~0.11m) | ✅ GPS සඳහා ප්‍රමාණවත් |
| Consistency across usages | ✅ සියලුම key generation toFixed(6) භාවිතා කරයි |
| Coordinate order | ✅ [lon, lat] convention consistent |
| Collision risk | ✅ 0.11m = adequate for road-shoulder routing |

**No precision issues found.** සියලුම hash/keys toFixed(6) භාවිතා කරයි, consistent.

---

### 6️⃣ Common Trunk Extension Wastage 🔴🔴 CRITICAL

#### 🔴🔴 ගැටළුව #6.1: Exact-Point Merge Only — No "Near-Miss" Merging

```typescript
// Trie merge logic (පේළි 730-738)
for (const pt of path) {
    const hash = coordToHash(pt);  // EXACT match only
    if (!curr.children.has(hash)) {
        curr.children.set(hash, { pt, children: new Map() });
    }
}
```

Paths දෙකක් එකම road segment එකේ 2m දුරින් යනවා නම්, Trie merge **නොවේ**. මෙයින් cables 2ක් parallel ලෙස run වේ.

**Impact Example:**
- 3 DPs එකම road එකේ, DP₁ 200m, DP₂ 250m, DP₃ 300m දුරින්
- Each Dijkstra path uses slightly different shoulder side based on `usedRoadShoulders` tracking
- Result: 3 parallel cables sharing 0 common trunk → 200+250+300 = 750m
- Optimal: 1 trunk cable + 3 short branches → ~320m
- **Wastage: ~130%**

#### 🔴🔴 ගැටළුව #6.2: No Post-Trie Optimization

Trie merge එකෙන් පසුව, cables optimize කිරීමේ step එකක් නොමැත:
- Cable A: A→B→C→D→E (400m)
- Cable B: A→B→C→F→G (400m)
- Both share A→B→C → total = 800m
- Better: Merge A→B→C as trunk (200m) + branch D→E (200m) + branch F→G (200m) → total = 600m
- **Current code already DOES this with the trie!** (Same hash = shared) → 600m correct.
- **BUT** the issue is when cables DONT share exact hashes even though they go through same road.

---

### 7️⃣ Junction Joint Placement Rules 🟡 Minor Issues

```typescript
if (distToFeed > PLAN_CONFIG.FEED_POINT_EXCLUSION_METERS) {  // > 20m
    let tooClose = false;
    for (const pc of plannedClosures) {
        if (dist < PLAN_CONFIG.CLOSURE_DEDUP_RADIUS_METERS) {  // < 40m
            tooClose = true;
        }
    }
    if (!tooClose) {
        plannedClosures.push({...junction joint...});
    }
}
```

| Rule | Value | Status |
|------|-------|--------|
| Min distance from Feed Point | 20m | ✅ සාමාන්‍යයි |
| Min distance from other closures | 40m | 🟡 Partially ok |
| Trunk vs Distribution capacity | 96 vs 48 | ✅ නිවැරදියි |
| Slack loop note | "+15m Slack Loop" | ℹ️ Note only (not in calculation) |

**🟡 ගැටළුව #7.1: Closure Dedup = 40m May Prevent Needed Junctions**

CLOSURE_DEDUP_RADIUS_METERS = 40m තරමක් විශාලයි. Branch point එක closure එකකට 39m දුරින් නම්, junction joint **skip වේ**. Cable split point එකේ joint box නොමැතිව, DOME closure cover නොමැති split point එකක් ඇතිවේ. Field splicing අපහසුයි.

**🟡 ගැටළුව #7.2: Branch Point < 20m from Feed = No Junction**

Feed point එකට 20m ඇතුලත branch point → junction joint skip. මෙය FDP/OLT enclosure එකෙන්ම split කිරීමට ඉඩ සලසයි — field-wise acceptable. නමුත් documentation එකේ split point record නොවේ.

**🟡 ගැටළුව #7.3: Junction dedup check runs against ALL plannedClosures**

Branch point එකක junction joint dedup check එක plannedClosures **array එකේ** පවතින closures සමග check කරයි. නමුත් අලුතින් එකතු කරන closure array එකට push වන්නේ branch point එකෙන් පසුවයි. Concurrent branch points (same trie level) එකිනෙක check නොකරයි!

---

## 🔎 Beyond Line 815 — Post-Trie Processing Issues

### A. 12m Pole Merge (පේළි 826–870)

```
Timeline: Poles generated → 12m merge → ... → greedy aggregation → safety injection
```

**🟡 ගැටළුව #A.1: Safety-injected poles NOT deduplicated at 12m**

Safety injection (පේළි 1000+) **12m merge එකෙන් පසුව** run වේ. Safety-injected pole එකක් existing pole එකකට 5m දුරින් වුවහොත් duplicate pole.

### B. Greedy Span Aggregation (පේළි 905–995)

**🔴 ගැටළුව #B.1: Order-Dependent Greedy Algorithm**

```typescript
while (simplified) {
    for (const cb of plannedCables) {        // Outer loop: cable order
        for (let i = 1; i < coords.length - 1; i++) {  // Inner loop: sequential
            if (dist1 + dist2 <= 38.0) {
                coords.splice(i, 1);         // Remove middle coordinate
                simplified = true;
                break;                       // Restart!
            }
        }
        if (simplified) break;
    }
}
```

`break` → restart loop. **Poles A-B-C-D with AB=20, BC=19, CD=19:**
- Pass 1: i=1 → AB+BC=39 > 38 → skip; i=2 → BC+CD=38 ≤ 38 → merge C
- Result: A-B-D (AB=20, BD=38)
- Now check B: A-B covered, B-D=38 ≤ 38 but B is now at index 1 (was 2)
- If we removed B instead of C: AB=20+19=39 > 38 → skip → can't merge
- **Result depends on which direction the loop processes!**

**🔴 ගැටළුව #B.2: Junction Protection Gap — 10m vs actual offset**

Poles near junctions are protected at 10m. But road shoulder offset is 7.5m (major roads). A pole at 10.5m from intersection center (with 7.5m offset) might not be protected. The 10m radius leaves only 2.5m effective margin. This could let junction-adjacent poles be accidentally removed.

### C. Safety Injection Nudge (පේළි 1075–1128) — PREVIOUSLY FLAGGED, NOW PARTIALLY FIXED

**🟢 Improvement:** පෙර audit එකේ flag කළ Issue #3 (skipped pole spans) **partially addressed**. Centerline/in intersection poles skip වුවහොත්, දැන් **7m perpendicular nudge** කර pole තබයි.

**🔴 නව ගැටළුව #C.1: Nudged Pole + Cable Coordinate Mismatch**

```typescript
if (nudged) {
    plannedPoles.push(newPole);          // Pole at nudged position
}
newCoords.push([ipLon, ipLat]);          // Cable STILL goes through skipped point!
```

⚠️ **Cable coordinate = original centerline point. Pole position = 7m offset. Cable path සහ pole position අතර 7m gap!**

**🟡 නව ගැටළුව #C.2: Nudge direction may conflict with road side**

Nudge always offsets to the right of road direction. But if the road's right shoulder is already occupied (building, waterway), this is suboptimal. No validation of the nudged position.

**🟡 නව ගැටළුව #C.3: Safety-injected pole height road crossing check EXISTS**

Line 1040-1065: `isRoadCrossing` check using 30m intersection proximity + roundabout check → height 10 vs 9. **This check WAS in the safety injection loop!** My previous Issue #2 was INCORRECT — the check is present. ✅

### D. Drop Cable Exclusion in Safety Injection (පේළි 1000)

```typescript
if (cb.cableType === 'DROP') continue;
```

✅ Correct — drop cables are short (<50m) and don't need safety injection.

---

## 📊 Final Summary

### 🔴🔴 CRITICAL (Must Fix) — 4 items

| # | ගැටළුව | පේළි | Impact |
|---|--------|------|--------|
| **4.1** | **Independent Dijkstra paths → no global tree optimization** | 715-738 | Cable wastage 10-30% |
| **6.1** | **Exact-match hash → no near-miss path merging** | 724 | Parallel cables on same road |
| **1.1** | **Tolerance-less Trie matching** | 727 | Missed shared trunks |
| **B.1** | **Order-dependent greedy pole aggregation** | 905-995 | Suboptimal pole removal |

### 🟡 MEDIUM (Should Fix) — 6 items

| # | ගැටළුව | පේළි |
|---|--------|------|
| **6.2** | No post-trie cable merge optimization | 738+ |
| **A.1** | Safety-injected poles skip 12m dedup | ~1070 |
| **C.1** | Nudged pole 7m away from cable path | ~1118 |
| **B.2** | Junction protection 10m too tight for offset | ~960 |
| **3.2** | No cable drum length limit check | 760+ |
| **7.1** | CLOSURE_DEDUP 40m may skip needed junctions | ~770 |

### ✅ PASS (Correct) — 8 items

| # | අයිතමය | Status |
|---|--------|--------|
| 1 | traverseTrie split logic (1 child/leaf/branch) | ✅ |
| 2 | Branch cable start at branch point | ✅ |
| 3 | `isTrunk` flag propagation (root→trunk, branches→false) | ✅ |
| 4 | coordToHash precision (0.11m, consistent) | ✅ |
| 5 | Key format consistency (all toFixed(6)) | ✅ |
| 6 | Drop cable exclusion from safety injection | ✅ |
| 7 | Safety injection road crossing height check (10m/9m) | ✅ |
| 8 | Trunk cable 48F vs Distribution 12F | ✅ |

---

## 🔧 Recommended Fixes by Priority

### Priority 1: Near-Miss Path Merging (Tolerance)
`coordToHash` වෙනුවට snapped segment ID-based matching. හෝ tolerance-based spatial hash (grid cells).

### Priority 2: Post-Trie Cable Merge Optimization
Parallel cables (same road, same direction) identify කර, longest common subpath merge කරන්න.

### Priority 3: Fix Greedy Aggregation Order Dependency
Simple fix: process poles in cost-benefit order (longest combined span first), not sequential order.

### Priority 4: Nudged Pole Cable Path Fix
Nudge position `newCoords` එකට update කරන්න, original centerline point වෙනුවට.

### Priority 5: Safety-Injected Poles → 12m Dedup
Safety injection end එකේදී 12m dedup pass එකක් run කරන්න.
