import { useState, useEffect } from 'react';

interface ColumnConfig {
    key: string;
    label: string;
    required?: boolean;
}

interface TableSettings {
    tableName: string;
    availableColumns: ColumnConfig[];
    visibleColumns: string[]; // Ordered array of visible column keys
}

/**
 * Hook to consume table column settings configured in admin/settings
 * Returns visible columns in the order defined by admin
 * 
 * @param tableName - The table identifier (e.g. 'pending_sod', 'inventory_stock')
 */
export function useTableColumnSettings(tableName: string) {
    const [settings, setSettings] = useState<TableSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const resp = await fetch(`/api/admin/table-settings?tableName=${tableName}`);
                const data = await resp.json();
                setSettings(data);
            } catch (err) {
                console.error('Failed to fetch table settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [tableName]);

    /** Check if a column is visible (default: visible if no settings) */
    const isColumnVisible = (columnKey: string): boolean => {
        if (!settings || !settings.visibleColumns) return true;
        return settings.visibleColumns.includes(columnKey);
    };

    /** Get visible columns in admin-defined order */
    const getOrderedVisibleColumns = (): string[] => {
        if (!settings || !settings.visibleColumns) return [];
        return settings.visibleColumns;
    };

    /** Get column index for ordering (lower = more left) */
    const getColumnOrder = (columnKey: string): number => {
        if (!settings || !settings.visibleColumns) return 999;
        const idx = settings.visibleColumns.indexOf(columnKey);
        return idx === -1 ? 999 : idx;
    };

    return {
        settings,
        loading,
        isColumnVisible,
        visibleColumns: settings?.visibleColumns || [],
        getOrderedVisibleColumns,
        getColumnOrder,
    };
}
