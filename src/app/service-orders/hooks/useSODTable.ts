"use client";

import { useState, useMemo } from "react";
import { ServiceOrder } from "@/types/service-order";

export function useSODTable(items: ServiceOrder[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    const isAllSelected = items.length > 0 && selectedIds.size === items.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;

    return {
        selectedIds,
        setSelectedIds,
        toggleSelect,
        toggleAll,
        isAllSelected,
        isSomeSelected
    };
}
