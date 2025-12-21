"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';

interface ColumnConfig {
    key: string;
    label: string;
    required?: boolean;
}

interface TableSettings {
    tableName: string;
    availableColumns: ColumnConfig[];
    visibleColumns: string[];
}

const TABLE_LABELS: Record<string, string> = {
    'pending_sod': 'Pending Service Orders',
    'completed_sod': 'Completed Service Orders',
    'return_sod': 'Return Service Orders',
    'restore_request': 'Restore Requests'
};

export default function TableSettingsPage() {
    const [settings, setSettings] = useState<Record<string, TableSettings>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [draggedItem, setDraggedItem] = useState<{ tableName: string; index: number } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Check if user is Admin or Super Admin
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                setIsAuthorized(true);
                fetchSettings();
            } else {
                router.push('/dashboard');
            }
        } else {
            router.push('/login');
        }
    }, [router]);

    const fetchSettings = async () => {
        try {
            const resp = await fetch('/api/admin/table-settings');
            const data = await resp.json();
            setSettings(data);
        } catch (err) {
            console.error('Failed to fetch settings');
        } finally {
            setLoading(false);
        }
    };

    const handleColumnToggle = (tableName: string, columnKey: string) => {
        setSettings(prev => {
            const tableSettings = prev[tableName];
            if (!tableSettings) return prev;

            const column = tableSettings.availableColumns.find(c => c.key === columnKey);
            if (column?.required) return prev;

            const isVisible = tableSettings.visibleColumns.includes(columnKey);
            let visibleColumns: string[];

            if (isVisible) {
                visibleColumns = tableSettings.visibleColumns.filter(k => k !== columnKey);
            } else {
                // Add at the end of visible columns
                visibleColumns = [...tableSettings.visibleColumns, columnKey];
            }

            return {
                ...prev,
                [tableName]: {
                    ...tableSettings,
                    visibleColumns
                }
            };
        });
    };

    const handleDragStart = (tableName: string, index: number) => {
        setDraggedItem({ tableName, index });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (tableName: string, dropIndex: number) => {
        if (!draggedItem || draggedItem.tableName !== tableName) return;

        setSettings(prev => {
            const tableSettings = prev[tableName];
            if (!tableSettings) return prev;

            const newVisibleColumns = [...tableSettings.visibleColumns];
            const [draggedColumn] = newVisibleColumns.splice(draggedItem.index, 1);
            newVisibleColumns.splice(dropIndex, 0, draggedColumn);

            return {
                ...prev,
                [tableName]: {
                    ...tableSettings,
                    visibleColumns: newVisibleColumns
                }
            };
        });

        setDraggedItem(null);
    };

    const moveColumn = (tableName: string, index: number, direction: 'up' | 'down') => {
        setSettings(prev => {
            const tableSettings = prev[tableName];
            if (!tableSettings) return prev;

            const newVisibleColumns = [...tableSettings.visibleColumns];
            const newIndex = direction === 'up' ? index - 1 : index + 1;

            if (newIndex < 0 || newIndex >= newVisibleColumns.length) return prev;

            [newVisibleColumns[index], newVisibleColumns[newIndex]] =
                [newVisibleColumns[newIndex], newVisibleColumns[index]];

            return {
                ...prev,
                [tableName]: {
                    ...tableSettings,
                    visibleColumns: newVisibleColumns
                }
            };
        });
    };

    const handleSave = async (tableName: string) => {
        setSaving(tableName);
        try {
            const resp = await fetch('/api/admin/table-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableName,
                    visibleColumns: settings[tableName].visibleColumns
                })
            });

            if (resp.ok) {
                setSuccessMessage(`${TABLE_LABELS[tableName]} settings saved successfully!`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                alert('Failed to save settings');
            }
        } catch (err) {
            alert('Failed to save settings');
        } finally {
            setSaving(null);
        }
    };

    const handleSelectAll = (tableName: string) => {
        setSettings(prev => {
            const tableSettings = prev[tableName];
            if (!tableSettings) return prev;

            return {
                ...prev,
                [tableName]: {
                    ...tableSettings,
                    visibleColumns: tableSettings.availableColumns.map(c => c.key)
                }
            };
        });
    };

    const handleDeselectAll = (tableName: string) => {
        setSettings(prev => {
            const tableSettings = prev[tableName];
            if (!tableSettings) return prev;

            const requiredColumns = tableSettings.availableColumns
                .filter(c => c.required)
                .map(c => c.key);

            return {
                ...prev,
                [tableName]: {
                    ...tableSettings,
                    visibleColumns: requiredColumns
                }
            };
        });
    };

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-500">Checking authorization...</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-slate-500">Loading settings...</div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-slate-900">Table Column Settings</h1>
                            <p className="text-sm text-slate-500">Configure which columns are visible and their order in each table. Drag to reorder columns.</p>
                        </div>

                        {successMessage && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                                ✅ {successMessage}
                            </div>
                        )}

                        <div className="grid gap-6">
                            {Object.entries(settings).map(([tableName, tableSettings]) => {
                                if (!tableSettings || !tableSettings.availableColumns || !tableSettings.visibleColumns) {
                                    return null;
                                }

                                const getColumnLabel = (key: string) => {
                                    const col = tableSettings.availableColumns.find(c => c.key === key);
                                    return col?.label || key;
                                };

                                const isRequired = (key: string) => {
                                    const col = tableSettings.availableColumns.find(c => c.key === key);
                                    return col?.required || false;
                                };

                                return (
                                    <div key={tableName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h2 className="font-semibold text-slate-900">{TABLE_LABELS[tableName] || tableName}</h2>
                                                    <p className="text-xs text-slate-500">
                                                        {tableSettings.visibleColumns?.length || 0} of {tableSettings.availableColumns?.length || 0} columns visible
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleSelectAll(tableName)}
                                                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeselectAll(tableName)}
                                                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                                                    >
                                                        Deselect All
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {/* Visible Columns - Orderable */}
                                            <div className="mb-4">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-2">Visible Columns (drag to reorder)</h3>
                                                <div className="space-y-2">
                                                    {tableSettings.visibleColumns.map((columnKey, index) => (
                                                        <div
                                                            key={columnKey}
                                                            draggable={!isRequired(columnKey)}
                                                            onDragStart={() => handleDragStart(tableName, index)}
                                                            onDragOver={handleDragOver}
                                                            onDrop={() => handleDrop(tableName, index)}
                                                            className={`flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/30 transition-all ${!isRequired(columnKey) ? 'cursor-move hover:shadow-md' : ''
                                                                }`}
                                                        >
                                                            <span className="text-slate-400 cursor-move">⋮⋮</span>
                                                            <span className="flex-1 text-sm font-medium text-primary">
                                                                {getColumnLabel(columnKey)}
                                                                {isRequired(columnKey) && <span className="text-xs ml-1 text-slate-500">(Required)</span>}
                                                            </span>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => moveColumn(tableName, index, 'up')}
                                                                    disabled={index === 0}
                                                                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                                    title="Move Up"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    onClick={() => moveColumn(tableName, index, 'down')}
                                                                    disabled={index === tableSettings.visibleColumns.length - 1}
                                                                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                                    title="Move Down"
                                                                >
                                                                    ↓
                                                                </button>
                                                                {!isRequired(columnKey) && (
                                                                    <button
                                                                        onClick={() => handleColumnToggle(tableName, columnKey)}
                                                                        className="p-1 text-red-400 hover:text-red-600"
                                                                        title="Remove"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Hidden Columns */}
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-700 mb-2">Available Columns (click to add)</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {tableSettings.availableColumns
                                                        .filter(col => !tableSettings.visibleColumns.includes(col.key))
                                                        .map(column => (
                                                            <button
                                                                key={column.key}
                                                                onClick={() => handleColumnToggle(tableName, column.key)}
                                                                className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                            >
                                                                + {column.label}
                                                            </button>
                                                        ))}
                                                    {tableSettings.availableColumns.filter(col => !tableSettings.visibleColumns.includes(col.key)).length === 0 && (
                                                        <span className="text-sm text-slate-400 italic">All columns are visible</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                            <button
                                                onClick={() => handleSave(tableName)}
                                                disabled={saving === tableName}
                                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {saving === tableName ? (
                                                    <>
                                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Saving...
                                                    </>
                                                ) : (
                                                    'Save Settings'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
