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
        const contractorToken = typeof window !== 'undefined' ? localStorage.getItem('contractor_token') : null;

        const headers: ContractorAuthHeaders = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        if (contractorToken) {
            headers['Authorization'] = `Bearer ${contractorToken}`;
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
