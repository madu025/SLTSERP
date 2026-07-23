"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    RefreshCw, Plus, Trash2, RotateCcw, Search, 
    CheckCircle2, AlertCircle, Tag, Layers, GripVertical, 
    ChevronUp, ChevronDown, Zap, PenLine, Edit2, Check, X,
    Sparkles, SlidersHorizontal
} from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';

interface MappingColumn {
    key: string;
    label: string;
    description: string;
    category?: string;
    syncMode?: 'AUTO' | 'MANUAL';
    terms: string[];
}

interface ToastNotice {
    type: 'success' | 'error';
    message: string;
}

function SFAuditHeaderMappingContent() {
    const [mappingColumns, setMappingColumns] = useState<MappingColumn[]>([]);
    const [mappingLoading, setMappingLoading] = useState(false);
    const [savingMapping, setSavingMapping] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Filter & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // Inline Editing
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // Add New Column Drawer/Panel Toggle
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [newColLabel, setNewColLabel] = useState('');
    const [newColCategory, setNewColCategory] = useState('');
    const [newColDesc, setNewColDesc] = useState('');
    const [newColSyncMode, setNewColSyncMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');

    // Toast
    const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null);

    // Drag and drop states
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToastNotice({ message, type });
        setTimeout(() => setToastNotice(null), 3500);
    }, []);

    const fetchMappingConfig = useCallback(async () => {
        setMappingLoading(true);
        try {
            const res = await fetch(`/api/finance/sf-audit/mapping-config?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const data = await res.json();
                setMappingColumns(data.data?.columns || data.columns || []);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load header mapping rules', 'error');
        } finally {
            setMappingLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchMappingConfig();
    }, [fetchMappingConfig]);

    const handleSaveMapping = async () => {
        setSavingMapping(true);
        try {
            const res = await fetch('/api/finance/sf-audit/mapping-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns: mappingColumns })
            });
            if (res.ok) {
                showToast('SF Audit Material Header & Column Mapping saved successfully!', 'success');
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to save mapping', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error saving mapping config', 'error');
        } finally {
            setSavingMapping(false);
        }
    };

    const handleResetDefault = async () => {
        if (!confirm('Are you sure you want to reset all material header mappings back to Admin Settings active categories?')) return;
        setResetting(true);
        try {
            const res = await fetch('/api/finance/sf-audit/mapping-config', { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                setMappingColumns(data.data?.columns || data.columns || []);
                showToast('Reset header mapping rules to Admin Settings categories successfully!', 'success');
            } else {
                showToast('Failed to reset mapping rules', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error resetting mapping rules', 'error');
        } finally {
            setResetting(false);
        }
    };

    // Toggle Sync Mode (AUTO <-> MANUAL) inline
    const handleToggleSyncMode = (colIdx: number) => {
        const updated = [...mappingColumns];
        const current = updated[colIdx].syncMode || 'MANUAL';
        updated[colIdx].syncMode = current === 'AUTO' ? 'MANUAL' : 'AUTO';
        setMappingColumns(updated);
        showToast(`Changed ${updated[colIdx].label} sync mode to ${updated[colIdx].syncMode}`, 'success');
    };

    // Inline Editing Handlers
    const startEditing = (col: MappingColumn) => {
        setEditingKey(col.key);
        setEditLabel(col.label);
        setEditCategory(col.category || '');
        setEditDesc(col.description || '');
    };

    const saveInlineEdit = (colIdx: number) => {
        const updated = [...mappingColumns];
        updated[colIdx] = {
            ...updated[colIdx],
            label: editLabel.trim().toUpperCase() || updated[colIdx].label,
            category: editCategory.trim().toUpperCase() || updated[colIdx].category,
            description: editDesc.trim() || updated[colIdx].description
        };
        setMappingColumns(updated);
        setEditingKey(null);
        showToast('Header details updated!', 'success');
    };

    const cancelInlineEdit = () => {
        setEditingKey(null);
    };

    // Term Management
    const handleAddTerm = (colIdx: number, newTerm: string) => {
        if (!newTerm.trim()) return;
        const updated = [...mappingColumns];
        const termUpper = newTerm.trim().toUpperCase();
        if (!updated[colIdx].terms.includes(termUpper)) {
            updated[colIdx].terms.push(termUpper);
            setMappingColumns(updated);
        }
    };

    const handleRemoveTerm = (colIdx: number, termIdx: number) => {
        const updated = [...mappingColumns];
        updated[colIdx].terms.splice(termIdx, 1);
        setMappingColumns(updated);
    };

    const handleRemoveColumn = (colIdx: number) => {
        const updated = [...mappingColumns];
        updated.splice(colIdx, 1);
        setMappingColumns(updated);
    };

    const handleAddColumn = () => {
        if (!newColLabel.trim()) return;
        const key = newColLabel.trim().toUpperCase().replace(/\s+/g, '-');
        setMappingColumns([
            ...mappingColumns,
            {
                key,
                label: newColLabel.trim().toUpperCase(),
                description: newColDesc.trim() || newColLabel.trim(),
                category: (newColCategory.trim() || 'CUSTOM').toUpperCase(),
                syncMode: newColSyncMode,
                terms: [key]
            }
        ]);
        setNewColLabel('');
        setNewColDesc('');
        setNewColCategory('');
        setNewColSyncMode('MANUAL');
        setShowAddPanel(false);
        showToast('New column header added!', 'success');
    };

    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== index) {
            setDragOverIdx(index);
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === targetIndex) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }

        const updated = [...mappingColumns];
        const [movedItem] = updated.splice(draggedIdx, 1);
        updated.splice(targetIndex, 0, movedItem);

        setMappingColumns(updated);
        setDraggedIdx(null);
        setDragOverIdx(null);
        showToast('Header sequence reordered!', 'success');
    };

    const handleMoveRow = (index: number, direction: 'UP' | 'DOWN') => {
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= mappingColumns.length) return;

        const updated = [...mappingColumns];
        const [movedItem] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, movedItem);

        setMappingColumns(updated);
    };

    // Categories List for Filter Tabs
    const categoriesList = useMemo(() => {
        const cats = new Set<string>();
        mappingColumns.forEach(c => {
            if (c.category) cats.add(c.category.toUpperCase());
        });
        return Array.from(cats);
    }, [mappingColumns]);

    const filteredColumns = useMemo(() => {
        return mappingColumns.filter(c => {
            const matchesCat = selectedCategory === 'ALL' || (c.category && c.category.toUpperCase() === selectedCategory);
            if (!matchesCat) return false;

            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return (
                c.label.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q) ||
                (c.category && c.category.toLowerCase().includes(q)) ||
                c.terms.some(t => t.toLowerCase().includes(q))
            );
        });
    }, [mappingColumns, selectedCategory, searchTerm]);

    return (
        <RoleGuard allowedRoles={['SF_AUDIT', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']}>
            <div className="flex h-screen bg-slate-900/5 dark:bg-background text-foreground overflow-hidden font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    <Header />

                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                        {/* Toast Alert */}
                        {toastNotice && (
                            <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold transition-all animate-in slide-in-from-top-2 ${toastNotice.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300' : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-700 dark:text-rose-300'}`}>
                                {toastNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                                {toastNotice.message}
                            </div>
                        )}

                        {/* Top Header & Actions Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-card p-5 rounded-2xl border border-border shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                                    <SlidersHorizontal className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <Badge variant="default" className="font-mono text-[9px] uppercase tracking-wider px-2 py-0 bg-primary/20 text-primary border-primary/30">
                                            SF AUDIT ENGINE
                                        </Badge>
                                        <Badge variant="outline" className="text-[9px] px-2 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                            EASY HEADER CONFIGURATOR
                                        </Badge>
                                    </div>
                                    <h1 className="text-xl font-black tracking-tight text-foreground">
                                        Invoice Header & Material Alias Rules
                                    </h1>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Manage contractor invoice table headers, category groups, auto-sync modes, and item search terms.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button 
                                    onClick={() => setShowAddPanel(!showAddPanel)} 
                                    variant={showAddPanel ? "secondary" : "default"}
                                    className="gap-1.5 text-xs h-9 font-bold px-3 shadow-sm"
                                >
                                    {showAddPanel ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                    {showAddPanel ? 'Close Form' : 'New Header Column'}
                                </Button>

                                <Button onClick={fetchMappingConfig} variant="outline" className="gap-1.5 text-xs h-9 font-semibold">
                                    <RefreshCw className={`w-3.5 h-3.5 ${mappingLoading ? 'animate-spin' : ''}`} /> Refresh
                                </Button>

                                <Button onClick={handleResetDefault} variant="outline" disabled={resetting} className="gap-1.5 text-xs h-9 border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 font-semibold">
                                    <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                                </Button>

                                <Button
                                    onClick={handleSaveMapping}
                                    disabled={savingMapping}
                                    className="bg-primary text-primary-foreground font-black text-xs px-5 h-9 shadow-md gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    {savingMapping ? 'Saving...' : 'Save All Rules'}
                                </Button>
                            </div>
                        </div>

                        {/* Collapsible Add New Column Panel */}
                        {showAddPanel && (
                            <Card className="bg-white dark:bg-card border border-primary/30 p-5 shadow-lg space-y-4 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <h3 className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4" /> Add New Material Header Column
                                    </h3>
                                    <button onClick={() => setShowAddPanel(false)} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Column Label *</label>
                                        <Input
                                            value={newColLabel}
                                            onChange={(e) => setNewColLabel(e.target.value)}
                                            placeholder="e.g. F1 / G1 / SPLITTER"
                                            className="bg-background border-input text-foreground text-xs mt-1 font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Category Group</label>
                                        <Input
                                            value={newColCategory}
                                            onChange={(e) => setNewColCategory(e.target.value)}
                                            placeholder="e.g. DROP WIRE / HARDWARE"
                                            className="bg-background border-input text-foreground text-xs mt-1 uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Description</label>
                                        <Input
                                            value={newColDesc}
                                            onChange={(e) => setNewColDesc(e.target.value)}
                                            placeholder="e.g. Optical Splitter 1x8 Unit"
                                            className="bg-background border-input text-foreground text-xs mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Sync Mode</label>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <button
                                                type="button"
                                                onClick={() => setNewColSyncMode('AUTO')}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    newColSyncMode === 'AUTO'
                                                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300 shadow-xs'
                                                        : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                                }`}
                                            >
                                                <Zap className="w-3 h-3 text-emerald-600" /> AUTO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewColSyncMode('MANUAL')}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    newColSyncMode === 'MANUAL'
                                                        ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300 shadow-xs'
                                                        : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                                }`}
                                            >
                                                <PenLine className="w-3 h-3 text-amber-600" /> MANUAL
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button onClick={() => setShowAddPanel(false)} variant="outline" className="text-xs h-8">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleAddColumn} className="bg-primary text-primary-foreground text-xs font-bold h-8 gap-1.5">
                                        <Plus className="w-3.5 h-3.5" /> Confirm Add Header
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* Search & Category Filter Tabs */}
                        <Card className="bg-white dark:bg-card border border-border p-4 shadow-sm space-y-3 rounded-2xl">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                {/* Category Quick Filters */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-extrabold uppercase text-muted-foreground mr-1 flex items-center gap-1">
                                        <Layers className="w-3 h-3" /> Filter:
                                    </span>
                                    <button
                                        onClick={() => setSelectedCategory('ALL')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                            selectedCategory === 'ALL'
                                                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                                        }`}
                                    >
                                        ALL ({mappingColumns.length})
                                    </button>
                                    {categoriesList.map((cat) => {
                                        const count = mappingColumns.filter(c => c.category?.toUpperCase() === cat).length;
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                                    selectedCategory === cat
                                                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                                        : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                                                }`}
                                            >
                                                {cat} ({count})
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Search Bar */}
                                <div className="relative w-full sm:w-72">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search header, category or term..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-background border-input text-xs h-8 text-foreground focus:border-primary rounded-lg"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Mappings Table */}
                        <Card className="bg-white dark:bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-muted/60 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                                        <tr>
                                            <th className="p-3 w-12 text-center border-r border-border/50">Order</th>
                                            <th className="p-3 w-44 border-r border-border/50">Column Header</th>
                                            <th className="p-3 w-28 text-center border-r border-border/50">Sync Mode</th>
                                            <th className="p-3 w-40 border-r border-border/50">Category Group</th>
                                            <th className="p-3 w-48 border-r border-border/50">Description</th>
                                            <th className="p-3 border-r border-border/50">Matched Aliases & Search Terms</th>
                                            <th className="p-3 w-28 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60 bg-card">
                                        {filteredColumns.length === 0 ? (
                                            <tr key="empty">
                                                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center space-y-2">
                                                        <Search className="w-8 h-8 text-muted-foreground/40" />
                                                        <p className="font-semibold text-xs">No column header mapping rules match your criteria.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredColumns.map((col, cIdx) => {
                                                const realIdx = mappingColumns.findIndex(c => c.key === col.key);
                                                const isEditing = editingKey === col.key;

                                                return (
                                                    <tr
                                                        key={col.key || cIdx}
                                                        draggable={!isEditing}
                                                        onDragStart={(e) => handleDragStart(e, realIdx)}
                                                        onDragOver={(e) => handleDragOver(e, realIdx)}
                                                        onDrop={(e) => handleDrop(e, realIdx)}
                                                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                                                        className={`transition-all duration-150 ${draggedIdx === realIdx ? 'opacity-30 bg-primary/10' : ''} ${dragOverIdx === realIdx ? 'border-t-2 border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                                                    >
                                                        {/* 1. Drag & Order */}
                                                        <td className="p-3 border-r border-border/50 text-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <GripVertical className="w-4 h-4 text-muted-foreground/60" />
                                                                <span className="font-mono text-xs font-bold text-muted-foreground">{realIdx + 1}</span>
                                                            </div>
                                                        </td>

                                                        {/* 2. Column Header Label */}
                                                        <td className="p-3 border-r border-border/50 font-mono font-black text-primary">
                                                            {isEditing ? (
                                                                <Input
                                                                    value={editLabel}
                                                                    onChange={(e) => setEditLabel(e.target.value)}
                                                                    className="h-7 text-xs font-mono font-bold bg-background uppercase border-primary"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Tag className="w-3.5 h-3.5 text-primary/80" />
                                                                    <span className="text-sm tracking-tight">{col.label}</span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 3. Sync Mode (Click to Toggle) */}
                                                        <td className="p-3 border-r border-border/50 text-center select-none">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleSyncMode(realIdx)}
                                                                title="Click to toggle Sync Mode (AUTO / MANUAL)"
                                                                className="transition-transform hover:scale-105"
                                                            >
                                                                {col.syncMode === 'AUTO' ? (
                                                                    <Badge className="text-[10px] font-extrabold gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs cursor-pointer">
                                                                        <Zap className="w-3 h-3 text-emerald-600" /> AUTO
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="text-[10px] font-extrabold gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 shadow-2xs cursor-pointer">
                                                                        <PenLine className="w-3 h-3 text-amber-600" /> MANUAL
                                                                    </Badge>
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* 4. Common Category Group */}
                                                        <td className="p-3 border-r border-border/50 font-mono">
                                                            {isEditing ? (
                                                                <Input
                                                                    value={editCategory}
                                                                    onChange={(e) => setEditCategory(e.target.value)}
                                                                    className="h-7 text-xs font-mono bg-background uppercase border-primary"
                                                                />
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary uppercase gap-1 px-2 py-0.5 bg-primary/5">
                                                                    <Layers className="w-3 h-3 text-primary/70" />
                                                                    {col.category || 'OTHERS'}
                                                                </Badge>
                                                            )}
                                                        </td>

                                                        {/* 5. Description */}
                                                        <td className="p-3 border-r border-border/50 text-foreground font-medium">
                                                            {isEditing ? (
                                                                <Input
                                                                    value={editDesc}
                                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                                    className="h-7 text-xs bg-background border-primary"
                                                                />
                                                            ) : (
                                                                <span>{col.description}</span>
                                                            )}
                                                        </td>

                                                        {/* 6. Matched Aliases & Search Terms */}
                                                        <td className="p-3 border-r border-border/50">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {col.terms.map((term, tIdx) => (
                                                                    <Badge key={tIdx} variant="secondary" className="text-[10px] font-mono gap-1 px-2 py-0.5 bg-muted border border-border">
                                                                        {term}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveTerm(realIdx, tIdx)}
                                                                            className="text-destructive hover:opacity-80 font-bold ml-1 text-xs"
                                                                            title="Remove Alias"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </Badge>
                                                                ))}
                                                                <Input
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleAddTerm(realIdx, (e.target as HTMLInputElement).value);
                                                                            (e.target as HTMLInputElement).value = '';
                                                                        }
                                                                    }}
                                                                    placeholder="+ Add term & Enter"
                                                                    className="bg-background border-input text-foreground text-[10px] h-6 w-36 inline-block font-mono focus:border-primary rounded-md"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* 7. Action Buttons */}
                                                        <td className="p-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {isEditing ? (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => saveInlineEdit(realIdx)}
                                                                            className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                                                            title="Save Edit"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={cancelInlineEdit}
                                                                            className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted"
                                                                            title="Cancel Edit"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => startEditing(col)}
                                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                                            title="Edit Details"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </Button>

                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            disabled={realIdx === 0}
                                                                            onClick={() => handleMoveRow(realIdx, 'UP')}
                                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                                            title="Move Up"
                                                                        >
                                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                                        </Button>

                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            disabled={realIdx === mappingColumns.length - 1}
                                                                            onClick={() => handleMoveRow(realIdx, 'DOWN')}
                                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                                            title="Move Down"
                                                                        >
                                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                                        </Button>

                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleRemoveColumn(realIdx)}
                                                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                                            title="Delete Header"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}

export default function SFAuditHeaderMappingPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen bg-background text-foreground items-center justify-center font-sans">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
        }>
            <SFAuditHeaderMappingContent />
        </Suspense>
    );
}
