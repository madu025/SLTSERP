# SLTSERP Project-Scoped Agent Guidelines

This document contains workspace-specific rules and instructions for coding agents operating on the SLTSERP codebase.

## 🏆 Mandatory Production-Level Coding Standards
All code additions, edits, or refactors MUST comply with strict production-level standards:
1. **API Endpoints**: Always wrap write and complex read route handlers with `apiHandler` (Zod validation, role checks, audit trail logging, unified error handling). Avoid manual `try/catch` and direct `NextResponse.json` returns.
2. **Decoupled Architecture**: No direct database access or queries (`prisma.[model]`) inside controller API routes (`route.ts`). All business logic must reside in a Service layer (`src/services/`).
3. **Database Integrity**: Never create "soft relations" (e.g. matching strings across tables with mismatched Prisma relations). Ensure all schemas are explicitly typed and linked with foreign keys.
4. **Strategic Indexing & Pagination**: Ensure any newly introduced query lookup field has an explicit `@@index` in the Prisma model. Implement server-side pagination for dynamic tables with more than 100 entries.
5. **No Caching Drift**: Declare `export const dynamic = 'force-dynamic'` in any GET API route returning dynamic database records.
6. **Zero `any` Type Tolerance**: Never use `any` or `any[]` types. All variables, API payloads, error catches, and return types must be strictly typed using interfaces, `Record<string, unknown>`, `unknown`, or Zod validation schemas. Using `any` is strictly prohibited and violates code quality standards.
7. **Algorithmic Efficiency (Big-O)**: Avoid $O(N^2)$ loops (e.g., nested `find` or database queries inside a loop). Utilize $O(1)$ Hash Maps, Sets, and Prisma `$transaction` batch operations to optimize time and space complexity.


## 🗺️ GIS Map Integration & OpenLayers Sizing Standards

To prevent the OpenLayers GIS map container from collapsing or rendering as a blank white space, all GIS/QGIS map enhancements must strictly follow these rules:

### 1. Explicit Sizing & Layout Constraints
* **Explicit Heights**: OpenLayers requires target divs to have defined heights. Never rely on dynamic Tailwind classes like `h-full` without an explicit parent pixel-height.
* **Style Spec**: The map target `div` must be initialized with inline styles specifying:
  ```tsx
  style={{ width: '100%', height, minHeight: '300px', display: 'block', position: 'relative' }}
  ```

### 2. Auto-Resizing with ResizeObserver
* Since the SLTSERP dashboard uses a collapsible sidebar and flexible layouts, the map dimensions can change dynamically.
* **Mandatory Observer Hook**: Always register a `ResizeObserver` inside a `useEffect` that listens to target div mutations and calls `map.updateSize()` immediately to refresh canvas tiles:
  ```typescript
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => {
      map.updateSize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [mapReady]);
  ```

### 3. Deferred Geometry Fitting (`fitExtent`)
* When rendering new imported GeoJSON coordinates and zooming to extents using `map.getView().fit(...)`, the call **must be deferred** by at least 100ms using a `setTimeout` to allow the browser DOM styles to settle:
  ```typescript
  setTimeout(() => {
    map.getView().fit(overallExtent, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
    map.updateSize();
  }, 100);
  ```

### 4. Type Safety & MapBrowserEvent Constraints
* OpenLayers events must use `PointerEvent | KeyboardEvent | WheelEvent` (or standard `PointerEvent`) as generic constraints on the `MapBrowserEvent` declaration. **Do not use `UIEvent`**, as it violates OpenLayers type constraints.
  ```typescript
  const handleClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => { ... }
  ```
* Always typecast features returned from pixel queries to standard `Feature` objects before invoking methods like `.setStyle()` to prevent typescript compilation errors on `FeatureLike`:
  ```typescript
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f) as Feature | undefined;
  ```

### 5. Render Loop State Rule
* **No Refs in JSX**: Never read `.current` properties of React `useRef` directly during JSX rendering (e.g. `lastSegmentDistanceRef.current`). Synchronize all computed values to React state hooks inside event handlers, and render from states instead.

## ⚡ Next.js Route Caching & State Refresh Standards

To ensure that UI data tables and dashboards refresh instantly after a resource is deleted, updated, or created, follow these rules:

### 1. Force Dynamic GET Routes
* All Next.js API GET routes that list entities (e.g., `/api/projects`, `/api/gis`) must disable Route Handler static caching by exporting `dynamic = 'force-dynamic'`:
  ```typescript
  export const dynamic = 'force-dynamic';
  ```

### 2. Client-Side Cache Busting & Headers
* When performing fetch calls to retrieve lists of items (especially when reloading after mutations like delete), always append a timestamp parameter (e.g., `_t=${Date.now()}`) to the URL and configure headers/cache options:
  ```typescript
  const res = await fetch(`/api/projects?status=COMPLETED&_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    }
  });
  ```

### 3. Optimistic Client State Management
* For better UX, always perform optimistic UI state updates (e.g., filter out a deleted item from the local array state immediately inside the `onDelete` success callback) before invoking the background reload fetch:
  ```typescript
  setExistingProjects((prev) => prev.filter((p) => p.id !== deletedId));
  ```

## 📉 Database Egress & Bandwidth Optimization Standards

To prevent high outbound data transfer costs and performance lag between Next.js APIs and the PostgreSQL database:

### 1. Targeted Database Selects (Prevent Egress Regress)
* **Never use broad `include` blocks** on models containing heavy JSON, metadata, history log, or blob columns (e.g. `ServiceOrder`, `ExtensionRawData`, `AuditLog`, `SODForensicAudit`).
* Always define explicit `select` fields picking only the columns consumed by the consumer:
  ```typescript
  // ✅ DO: Selective fetching
  const orders = await prisma.serviceOrder.findMany({
      select: {
          id: true,
          rtom: true,
          sltsStatus: true
      }
  });
  ```

### 2. DTO (Data Transfer Object) Pattern
* Cleanse database response objects in the Service layer before sending them down route handler controller responses. Only serialize and return the specific fields requested by client components to reduce browser network payload sizes.

### 3. Early and Active Pagination
* Server-side pagination is mandatory for all listing data services returning records potentially exceeding 100 entries. Implement cursor-based pagination (for infinite scrolls) or offset pagination (for indexed tables) early in development.


## 🗺️ Codebase Map & Token Optimization Standards

To keep context windows clean and save tokens, agents must use the codebase structural map file:

### 1. Consult the Map First
* Before performing broad workspace search queries or reading entire target directories, search the map file `.agent/CODEMAP.md` to locate classes, service methods, API routes, or database models.
* **CRITICAL TOKEN WARNING**: Never use `view_file` to read the entire `.agent/CODEMAP.md` file, as it is very large and will exhaust the context limit.
* Instead, always use `grep_search` to find the line numbers of the desired class/method/model in `.agent/CODEMAP.md`, then load only a small range of lines around it (e.g. using `StartLine` and `EndLine` in `view_file`).

### 2. Keep the Map Synced
* Whenever you modify files that alter method signatures, class exports, API routes, or Prisma schemas, you **MUST** run the updater command:
  ```bash
  npm run codemap:update
  ```
* Ensure this command runs successfully and commits any updates to `.agent/CODEMAP.md` along with your code changes.



