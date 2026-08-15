"use client";

import {  useState, useEffect  } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown } from 'lucide-react';

interface ContractorRecord {
    id: string;
    name: string;
    registrationNumber?: string | null;
}

export default function ContractorSwitcher() {
    const queryClient = useQueryClient();
    const [contractors, setContractors] = useState<ContractorRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [isAllowedUser, setIsAllowedUser] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const contractorUser = localStorage.getItem('contractor_user') || localStorage.getItem('user');
            if (contractorUser) {
                try {
                    const u = JSON.parse(contractorUser);
                    // Only show switcher if user is Admin, CEO, or Manager (NOT regular field contractor)
                    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OSP_MANAGER', 'AREA_MANAGER', 'MANAGER'];
                    if (u.role && allowedRoles.includes(u.role)) {
                        setIsAllowedUser(true);
                    }
                } catch {}
            }

            const savedId = localStorage.getItem('selected_contractor_id') || '';
            setSelectedId(savedId);
        }
    }, []);

    useEffect(() => {
        if (!isAllowedUser) return;

        // Fetch list of active contractors for selection
        fetch('/api/contractors?status=ACTIVE&_t=' + Date.now())
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                const list = json?.data?.contractors || json?.data || json || [];
                if (Array.isArray(list)) {
                    setContractors(list);
                }
            })
            .catch(() => {});
    }, [isAllowedUser]);

    if (!isAllowedUser) return null;

    const handleSelect = (id: string) => {
        setSelectedId(id);
        if (typeof window !== 'undefined') {
            if (id) {
                localStorage.setItem('selected_contractor_id', id);
            } else {
                localStorage.removeItem('selected_contractor_id');
            }
        }
        // Invalidate all contractor portal queries to force instant UI reload
        queryClient.invalidateQueries({ queryKey: ['contractor-my-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['contractor-my-inventory'] });
        queryClient.invalidateQueries({ queryKey: ['contractor-my-sods'] });
        queryClient.invalidateQueries({ queryKey: ['contractor-my-finance'] });
    };

    return (
        <div className="relative flex items-center">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/40 rounded-xl px-2.5 py-1 text-xs text-amber-400 font-bold shadow-md">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <select
                    value={selectedId}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer pr-4 appearance-none text-[11px]"
                >
                    <option value="" className="bg-slate-900 text-slate-200">-- Select Contractor --</option>
                    {contractors.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                            {c.name} {c.registrationNumber ? `(${c.registrationNumber})` : ''}
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3 h-3 text-amber-400 pointer-events-none -ml-3" />
            </div>
        </div>
    );
}
