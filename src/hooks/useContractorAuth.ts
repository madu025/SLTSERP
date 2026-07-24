"use client";

import { useCallback } from 'react';

export interface ContractorAuthHeaders extends Record<string, string> {
    'Cache-Control': string;
    'Pragma': string;
}

/**
 * Custom hook to build contractor portal authentication headers from localStorage.
 * Eliminates the duplicated getAuthHeaders() pattern across all contractor portal pages.
 */
export function useContractorAuth() {
    const getHeaders = useCallback((): ContractorAuthHeaders => {
        const contractorUser = typeof window !== 'undefined' ? localStorage.getItem('contractor_user') : null;
        const contractorToken = typeof window !== 'undefined' ? localStorage.getItem('contractor_token') : null;

        const headers: ContractorAuthHeaders = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
        }

        if (contractorUser) {
            try {
                const u = JSON.parse(contractorUser) as { id?: string; role?: string; contractorId?: string };
                if (u.id) headers['x-user-id'] = u.id;
                if (u.role) headers['x-user-role'] = u.role;
                if (u.contractorId) headers['x-contractor-id'] = u.contractorId;
            } catch {
                // Ignore malformed session data
            }
        }

        return headers;
    }, []);

    const getContractorId = useCallback((): string | null => {
        if (typeof window === 'undefined') return null;
        const contractorUser = localStorage.getItem('contractor_user');
        if (!contractorUser) return null;
        try {
            const u = JSON.parse(contractorUser) as { contractorId?: string };
            return u.contractorId || null;
        } catch {
            return null;
        }
    }, []);

    return { getHeaders, getContractorId };
}
