"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createStore, updateStore, deleteStore } from "@/actions/inventory-actions";

export function useStoreOperations() {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: async ({ id, data }: { id?: string; data: any }) => {
            if (id) return await updateStore(id, data);
            return await createStore(data);
        },
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Logistics registry synchronized");
                queryClient.invalidateQueries({ queryKey: ["stores"] });
            } else {
                toast.error(result.error || "Operation failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => await deleteStore(id),
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Store entity purged from registry");
                queryClient.invalidateQueries({ queryKey: ["stores"] });
            } else {
                toast.error(result.error || "Deletion failed");
            }
        },
        onError: (err: any) => toast.error(err.message)
    });

    return {
        upsertMutation,
        removeMutation,
        isPending: upsertMutation.isPending || removeMutation.isPending
    };
}
