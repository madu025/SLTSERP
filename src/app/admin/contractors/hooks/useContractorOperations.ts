"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContractorSchema } from "@/lib/validations/contractor.schema";

export function useContractorOperations() {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: ContractorSchema) => {
            const res = await fetch("/api/contractors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create contractor");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Contractor created successfully");
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await fetch("/api/contractors", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, id })
            });
            if (!res.ok) throw new Error("Update failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Contractor record updated");
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/contractors?id=${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Deletion failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Contractor removed from registry");
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/contractors", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "ACTIVE", documentStatus: "APPROVED" })
            });
            if (!res.ok) throw new Error("Approval failed");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Entity authorized and activated");
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/contractors", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "REJECTED", documentStatus: "REJECTED" })
            });
            if (!res.ok) throw new Error("Rejection failed");
            return res.json();
        },
        onSuccess: () => {
            toast.warning("Entity registration rejected");
            queryClient.invalidateQueries({ queryKey: ["contractors"] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    return {
        createMutation,
        updateMutation,
        deleteMutation,
        approveMutation,
        rejectMutation,
        isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || approveMutation.isPending || rejectMutation.isPending
    };
}
