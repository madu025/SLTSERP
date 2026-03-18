"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createItem, updateItem, deleteItem, mergeItemsAction, patchBulkItemsAction } from "@/actions/inventory-actions";

export function useItemOperations() {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: async ({ id, data }: { id?: string; data: any }) => {
            if (id) return await updateItem(id, data);
            return await createItem(data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Material registry synchronized");
                queryClient.invalidateQueries({ queryKey: ["items"] });
            } else {
                toast.error(result.error || "Operation failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => await deleteItem(id),
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Item purged from registry");
                queryClient.invalidateQueries({ queryKey: ["items"] });
            } else {
                toast.error(result.error || "Deletion failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    const bulkUpdateMutation = useMutation({
        mutationFn: async (updates: any[]) => await patchBulkItemsAction(updates),
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Bulk update completed");
                queryClient.invalidateQueries({ queryKey: ["items"] });
            } else {
                toast.error(result.error || "Bulk update failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    const mergeMutation = useMutation({
        mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => await mergeItemsAction(sourceId, targetId),
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Entities merged successfully");
                queryClient.invalidateQueries({ queryKey: ["items"] });
            } else {
                toast.error(result.error || "Merge failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    return {
        upsertMutation,
        removeMutation,
        bulkUpdateMutation,
        mergeMutation,
        isPending: upsertMutation.isPending || removeMutation.isPending || bulkUpdateMutation.isPending || mergeMutation.isPending
    };
}
