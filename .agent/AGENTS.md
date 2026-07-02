# SLTSERP Project-Scoped Agent Guidelines

This document contains workspace-specific rules and instructions for coding agents operating on the SLTSERP codebase.

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

