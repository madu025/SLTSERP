"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface InventoryItem {
    id: string;
    code: string;
    name: string;
    commonName: string;
    description?: string;
    unit: string;
    type?: string;
    category?: string;
    unitPrice?: number;
}

interface SearchableItemSelectProps {
    value: string;  // selected item ID
    onChange: (item: InventoryItem | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export default function SearchableItemSelect({
    value,
    onChange,
    placeholder = 'Search inventory item...',
    className,
    disabled = false,
}: SearchableItemSelectProps) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedItem = items.find(i => i.id === value);

    // Fetch items on mount
    useEffect(() => {
        fetchItems();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchItems = async (query?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (query) params.append('search', query);
            const res = await fetch(`/api/inventory/items?${params}`);
            if (res.ok) {
                const data = await res.json();
                setItems(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearch(q);
        // Debounce search
        const timer = setTimeout(() => fetchItems(q), 300);
        return () => clearTimeout(timer);
    };

    const handleSelect = (item: InventoryItem) => {
        onChange(item);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={dropdownRef} className={cn('relative', className)}>
            {/* Trigger Button */}
            <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                className="w-full justify-between text-left font-normal"
                onClick={() => setOpen(!open)}
            >
                {selectedItem ? (
                    <span className="truncate">
                        <span className="font-medium">{selectedItem.code}</span> - {selectedItem.name}
                        <span className="text-xs text-slate-400 ml-2">({selectedItem.unit})</span>
                    </span>
                ) : (
                    <span className="text-slate-400">{placeholder}</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                    {/* Search Input */}
                    <div className="flex items-center border-b border-slate-100 px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                            placeholder="Type to search items..."
                            value={search}
                            onChange={handleSearchChange}
                            autoFocus
                        />
                    </div>

                    {/* Items List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {loading ? (
                            <div className="py-6 text-center text-sm text-slate-400">
                                Loading...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-400">
                                No items found
                            </div>
                        ) : (
                            items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={cn(
                                        'w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 flex items-start gap-3 border-b border-slate-50 last:border-0',
                                        value === item.id && 'bg-blue-50'
                                    )}
                                    onClick={() => handleSelect(item)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {item.code}
                                            </span>
                                            <span className="font-medium text-slate-800 truncate">
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-xs text-slate-400">
                                                {item.commonName}
                                            </span>
                                            {item.unit && (
                                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                    {item.unit}
                                                </span>
                                            )}
                                            {item.category && (
                                                <span className="text-xs text-slate-400">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {value === item.id && (
                                        <Check className="h-4 w-4 text-blue-600 mt-1 shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
