# SLTSERP Clean Light Enterprise Design System

This document establishes the UI/UX design standard for all SLTSERP pages. All new features and redesigned pages must follow these guidelines to maintain a unified, high-density, professional appearance.

---

## 1. Core Color Tokens (Clean Light Theme)

All colors are light, flat, and use slate borders with subtle status highlights.

| Token | Class / Value | Usage |
|---|---|---|
| Page Background | `bg-slate-50` / `#F8FAFC` | Background of all dashboard page wrappers |
| Surface Background | `bg-white` / `#FFFFFF` | Cards, table containers, dialog boxes |
| Borders | `border-slate-200` | Borders around containers, dividers, table rows |
| Primary Blue | `bg-blue-600` / `#2563EB` | Call-to-actions, buttons, links, primary indicators |
| Primary Hover | `hover:bg-blue-700` | Hover states for blue buttons |
| Primary Dark Slate | `bg-slate-900` | Secondary primary buttons |
| Text Primary | `text-slate-900` / `#0F172A` | Main page titles, active text |
| Text Secondary | `text-slate-500` / `#64748B` | Sub-titles, captions, metadata |

---

## 2. Status Badges

To avoid neon or generic color palettes, use low-saturation background tints paired with darker typography:

- **Active / Success**: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Pending / Warning**: `bg-amber-50 text-amber-700 border-amber-200`
- **ARM Pending / Informational**: `bg-blue-50 text-blue-700 border-blue-200`
- **OSP Pending / Special**: `bg-purple-50 text-purple-700 border-purple-200`
- **Rejected / Error**: `bg-red-50 text-red-700 border-red-200`

---

## 3. High-Density Layout & Component Standards

### Page Wrapper Structure
All pages should follow a split flex container containing the `Sidebar` component and a main content viewport.
```tsx
<div className="erp-page-wrapper flex-row overflow-hidden">
  <Sidebar />
  <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
    <Header />
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Content goes here */}
    </div>
  </main>
</div>
```

### Stats Grid
Stats grids should sit directly under the page title. Keep padding compact (`p-3`), text sizes moderate, and utilize a grid size that dynamically scales (`grid-cols-2 lg:grid-cols-4 gap-3`).
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
  <Card className="rounded-xl border border-slate-200 bg-white">
    <CardContent className="p-3 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400">Total Count</p>
        <p className="text-base font-black text-slate-900">{count}</p>
      </div>
      <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
        <Building2 className="w-4 h-4" />
      </div>
    </CardContent>
  </Card>
</div>
```

### Toolbar Container
Inputs and filtering button tabs should be consolidated using the `.erp-toolbar` class. Use small button sizes (`h-8`, text sizes `text-[10px]`) for clean alignment.
```tsx
<div className="erp-toolbar flex-col md:flex-row justify-between gap-3">
  {/* Filters here */}
  <div className="relative w-full md:w-80">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
    <Input placeholder="Search..." className="h-8 pl-9 text-xs" />
  </div>
</div>
```

### Dense Data Table
Use the `.erp-table-container` wrapper. Column headers should be uppercase and bold (`font-black uppercase tracking-wider`). Action rows must use compact icon buttons with hover background transitions (`transition-all`).
```tsx
<div className="erp-table-container">
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr>
          <th className="w-12 text-center">#</th>
          <th>Title</th>
          <th>Status</th>
          <th className="text-right pr-6">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        <tr>
          <td className="text-center font-mono text-slate-400">1</td>
          <td>Item Name</td>
          <td><Badge>Active</Badge></td>
          <td className="text-right pr-6">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Edit className="w-3.5 h-3.5" /></Button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```
