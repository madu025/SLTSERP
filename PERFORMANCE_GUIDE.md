# Performance Optimization Guide - SLTSERP

## 🎯 Current Performance Status

### Database Indexes (Already Optimized)
✅ ServiceOrder model has indexes on:
- `opmcId`
- `rtom`
- `status`
- `soNum`
- `scheduledDate`

### Potential Bottlenecks to Monitor:

#### 1. **Service Orders Page**
**Current Load:**
- Fetches 50 SODs per page
- Includes contractor data
- Real-time filtering and sorting

**Optimization Done:**
- Pagination implemented (50 items/page)
- Server-side filtering by OPMC
- Efficient React Query caching

**Potential Issues:**
- If OPMC has 1000+ SODs, initial load might be slow
- Client-side filtering on large datasets

**Recommendations:**
```typescript
// Already implemented:
- Pagination ✅
- Server-side filtering ✅
- React Query caching ✅

// Future improvements if needed:
- Virtual scrolling for large tables
- Debounced search input
- Lazy loading of contractor data
```

---

#### 2. **Sync Operation**
**Current Implementation:**
- Batch processing (50 items at a time)
- Transaction-based updates
- Skip logic for completed SODs

**Potential Issues:**
- Large sync (500+ SODs) might take time
- Missing SOD detection runs after sync

**Current Optimizations:**
```typescript
// Batch processing
const batchSize = 50;
for (let i = 0; i < sltData.length; i += batchSize) {
    await prisma.$transaction(async (tx) => {
        // Process batch
    });
}
```

**Status:** ✅ Already optimized

---

#### 3. **React Query Cache**
**Current Setup:**
- Automatic caching
- Invalidation on mutations
- Refetch on window focus

**Optimization:**
```typescript
// Add staleTime to reduce unnecessary refetches
const { data: serviceOrders } = useQuery({
    queryKey: ["service-orders", selectedOpmcId, filterType, page],
    queryFn: fetchOrders,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 🔧 Quick Performance Improvements

### 1. Add React Query Optimization
**File:** `src/app/service-orders/page.tsx`

```typescript
// Current
const { data: serviceOrders = [] } = useQuery<ServiceOrder[]>({
    queryKey: ["service-orders", selectedOpmcId, filterType, page],
    queryFn: async () => { ... }
});

// Optimized
const { data: serviceOrders = [] } = useQuery<ServiceOrder[]>({
    queryKey: ["service-orders", selectedOpmcId, filterType, page],
    queryFn: async () => { ... },
    staleTime: 30000, // Don't refetch for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab switch
});
```

### 2. Debounce Search Input
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

// In component
const [searchInput, setSearchInput] = useState("");
const debouncedSearch = useDebouncedValue(searchInput, 300);

// Use debouncedSearch for filtering instead of searchTerm
```

### 3. Memoize Expensive Calculations
```typescript
import { useMemo } from 'react';

// Memoize missing count
const missingCount = useMemo(() => 
    serviceOrders.filter(o => o.comments?.includes('[MISSING FROM SYNC')).length,
    [serviceOrders]
);
```

---

## 📊 Performance Monitoring

### Browser DevTools
1. **Network Tab:**
   - Check API response times
   - Look for slow queries (>1s)

2. **Performance Tab:**
   - Record page load
   - Check for long tasks (>50ms)

3. **React DevTools Profiler:**
   - Identify unnecessary re-renders
   - Find slow components

### Database Query Performance
```sql
-- Check slow queries in PostgreSQL
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🎯 Performance Targets

### Current Status (Estimated)
- **Page Load:** ~500ms - 1s ✅
- **Search/Filter:** ~100ms - 200ms ✅
- **Sync Operation:** ~2-5s for 100 SODs ✅
- **Table Rendering:** ~200ms - 500ms ✅

### If Performance Degrades:
**Symptoms:**
- Page load > 3s
- Search lag > 500ms
- Table scroll janky

**Solutions:**
1. Enable virtual scrolling
2. Add server-side search
3. Optimize database queries
4. Add loading skeletons

---

## 💡 Quick Wins (Implement if needed)

### 1. Loading States
```typescript
{isLoading ? (
    <TableSkeleton rows={10} />
) : (
    <table>...</table>
)}
```

### 2. Error Boundaries
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
    <ServiceOrdersPage />
</ErrorBoundary>
```

### 3. Code Splitting
```typescript
// Already using dynamic imports ✅
const ManualEntryModal = dynamic(() => import("..."), { ssr: false });
```

---

## 🔍 Current Performance Assessment

### ✅ Already Optimized:
1. Database indexes
2. Pagination
3. Batch processing in sync
4. React Query caching
5. Dynamic imports for modals
6. Server-side filtering

### ⚠️ Monitor These:
1. Large OPMC datasets (1000+ SODs)
2. Sync operations with 500+ items
3. Client-side filtering performance

### 🚀 Future Optimizations (if needed):
1. Virtual scrolling for tables
2. Debounced search
3. Memoization of expensive calculations
4. Service Worker for offline support
5. CDN for static assets

---

## 📝 Performance Testing Commands

```bash
# Build for production
npm run build

# Analyze bundle size
npm run build -- --analyze

# Run Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Check bundle size
npx @next/bundle-analyzer
```

---

## 🎓 Summary

**Current Performance:** ✅ Good
- System is already well-optimized
- No major bottlenecks identified
- Pagination and caching in place

**Action Items:**
1. Monitor as data grows
2. Add React Query staleTime if needed
3. Consider virtual scrolling for 1000+ items
4. Keep eye on sync operation times

**Performance is currently GOOD. No immediate action required.** 🎉
