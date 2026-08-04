"use client";

import React, { useState, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface ColumnItem {
    key: string;
    label: string;
    required?: boolean;
}

interface ColumnLayoutBuilderProps {
    columns: ColumnItem[];
    visibleColumns: string[];
    onSave: (orderedVisibleColumns: string[]) => void;
    isSaving?: boolean;
}

// ─────────────────────────────────────────────────────────
// SORTABLE COLUMN ITEM
// ─────────────────────────────────────────────────────────

function SortableColumn({ column, isVisible, onToggle }: {
    column: ColumnItem;
    isVisible: boolean;
    onToggle: (key: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: column.key,
        disabled: column.required,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200",
                isVisible
                    ? "bg-white border-blue-200 shadow-sm"
                    : "bg-slate-50 border-slate-200 opacity-60",
                isDragging && "shadow-lg ring-2 ring-blue-400 z-50 scale-[1.02]",
                column.required && "cursor-default"
            )}
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                disabled={column.required}
                className={cn(
                    "p-1 rounded-md hover:bg-slate-100 transition-colors",
                    column.required
                        ? "cursor-not-allowed opacity-30"
                        : "cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                )}
                title={column.required ? "Required columns cannot be moved" : "Drag to reorder"}
            >
                <GripVertical className="w-4 h-4" />
            </button>

            {/* Column Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-xs font-bold truncate",
                        isVisible ? "text-slate-800" : "text-slate-400"
                    )}>
                        {column.label}
                    </span>
                    {column.required && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            <Lock className="w-2.5 h-2.5" />
                            Required
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{column.key}</span>
            </div>

            {/* Visibility Toggle */}
            <button
                onClick={() => !column.required && onToggle(column.key)}
                disabled={column.required}
                className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    column.required
                        ? "cursor-not-allowed opacity-30"
                        : isVisible
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 border border-slate-200"
                )}
                title={isVisible ? "Click to hide" : "Click to show"}
            >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// MAIN BUILDER COMPONENT
// ─────────────────────────────────────────────────────────

export function ColumnLayoutBuilder({ columns, visibleColumns: initialVisible, onSave, isSaving }: ColumnLayoutBuilderProps) {
    // State: ordered list of column keys (all columns in display order)
    const [orderedKeys, setOrderedKeys] = useState<string[]>(() => {
        const visible = initialVisible || [];
        const allKeys = columns.map(c => c.key);
        // Put visible columns first (in their saved order), then hidden ones
        const visibleSet = new Set(visible);
        const ordered = visible.filter(k => allKeys.includes(k));
        const hidden = allKeys.filter(k => !visibleSet.has(k));
        return [...ordered, ...hidden];
    });

    // Track which columns are visible
    const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
        const visibleSet = new Set(initialVisible || []);
        const map: Record<string, boolean> = {};
        columns.forEach(c => {
            map[c.key] = c.required ? true : visibleSet.has(c.key);
        });
        return map;
    });

    // Sync with props when they change
    const [prevProps, setPrevProps] = useState({ columns, initialVisible });
    if (columns !== prevProps.columns || initialVisible !== prevProps.initialVisible) {
        const visible = initialVisible || [];
        const allKeys = columns.map(c => c.key);
        const visibleSet = new Set(visible);
        const ordered = visible.filter(k => allKeys.includes(k));
        const hidden = allKeys.filter(k => !visibleSet.has(k));
        setOrderedKeys([...ordered, ...hidden]);

        const visMap: Record<string, boolean> = {};
        columns.forEach(c => {
            visMap[c.key] = c.required ? true : visibleSet.has(c.key);
        });
        setVisibility(visMap);
        setPrevProps({ columns, initialVisible });
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setOrderedKeys((items) => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            return arrayMove(items, oldIndex, newIndex);
        });
    }, []);

    const toggleVisibility = useCallback((key: string) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleSave = useCallback(() => {
        // Build the final ordered visible columns array
        const orderedVisible = orderedKeys.filter(k => visibility[k]);
        onSave(orderedVisible);
    }, [orderedKeys, visibility, onSave]);

    const visibleCount = orderedKeys.filter(k => visibility[k]).length;
    const totalCount = columns.length;

    const showAll = useCallback(() => {
        setVisibility(prev => {
            const next = { ...prev };
            columns.forEach(c => { next[c.key] = true; });
            return next;
        });
    }, [columns]);

    const hideAllOptional = useCallback(() => {
        setVisibility(prev => {
            const next = { ...prev };
            columns.forEach(c => { if (!c.required) next[c.key] = false; });
            return next;
        });
    }, [columns]);

    const resetToDefault = useCallback(() => {
        setOrderedKeys(columns.map(c => c.key));
        const visMap: Record<string, boolean> = {};
        columns.forEach(c => { visMap[c.key] = true; });
        setVisibility(visMap);
    }, [columns]);

    // Build column map for rendering
    const columnMap = React.useMemo(() => {
        const map: Record<string, ColumnItem> = {};
        columns.forEach(c => { map[c.key] = c; });
        return map;
    }, [columns]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Column Layout
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            {visibleCount} / {totalCount} Visible
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        Drag to reorder • Click eye to show/hide • Required columns cannot be hidden
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={resetToDefault}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={showAll}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                        Show All
                    </button>
                    <button
                        type="button"
                        onClick={hideAllOptional}
                        className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Hide Optional
                    </button>
                </div>
            </div>

            {/* Sortable List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={orderedKeys}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-1.5">
                        {orderedKeys.map(key => {
                            const col = columnMap[key];
                            if (!col) return null;
                            return (
                                <SortableColumn
                                    key={key}
                                    column={col}
                                    isVisible={visibility[key] ?? true}
                                    onToggle={toggleVisibility}
                                />
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Save Button */}
            <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                        "px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200",
                        isSaving
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                    )}
                >
                    {isSaving ? 'Saving...' : `Save Layout (${visibleCount} columns)`}
                </button>
            </div>
        </div>
    );
}
