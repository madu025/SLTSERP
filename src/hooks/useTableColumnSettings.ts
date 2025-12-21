import { useState, useEffect } from 'react';

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

    const isColumnVisible = (columnKey: string): boolean => {
        if (!settings || !settings.visibleColumns) return true; // Default to visible if no settings
        return settings.visibleColumns.includes(columnKey);
    };

    // Get columns in the correct order
    const getOrderedVisibleColumns = (): string[] => {
        if (!settings || !settings.visibleColumns) return [];
        return settings.visibleColumns;
    };

    return {
        settings,
        loading,
        isColumnVisible,
        visibleColumns: settings?.visibleColumns || [],
        getOrderedVisibleColumns
    };
}
