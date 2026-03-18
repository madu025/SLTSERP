"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useRoleOperations(sectionId: string) {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: async ({ id, data }: { id?: string; data: any }) => {
            const url = id
                ? `/api/admin/sections/${sectionId}/roles/${id}`
                : `/api/admin/sections/${sectionId}/roles`;
            const method = id ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to save role');
            return res.json();
        },
        onSuccess: (result) => {
            toast.success("Role saved successfully");
            queryClient.invalidateQueries({ queryKey: ['section-roles', sectionId] });
        },
        onError: (error: any) => toast.error(error.message || "Error saving role")
    });

    const removeMutation = useMutation({
        mutationFn: async (roleId: string) => {
            const res = await fetch(`/api/admin/sections/${sectionId}/roles/${roleId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete role');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Role deleted successfully");
            queryClient.invalidateQueries({ queryKey: ['section-roles', sectionId] });
        },
        onError: (error: any) => toast.error(error.message || "Error deleting role")
    });

    return {
        upsertMutation,
        removeMutation,
        isPending: upsertMutation.isPending || removeMutation.isPending
    };
}
