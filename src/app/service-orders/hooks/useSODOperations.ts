"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ServiceOrder } from "@/types/service-order";

export function useSODOperations(selectedRtomId: string, selectedRtom: string) {
    const queryClient = useQueryClient();

    const syncMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/service-orders/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rtomId: selectedRtomId, rtom: selectedRtom })
            });
            if (!res.ok) throw new Error("Sync failed");
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            const message = `Sync completed: ${data.created} created, ${data.updated} updated${data.markedAsMissing > 0 ? `, ${data.markedAsMissing} marked as missing` : ''}`;
            toast.success(message);
        },
        onError: () => toast.error("Sync failed")
    });

    const addOrderMutation = useMutation({
        mutationFn: async (data: Partial<ServiceOrder>) => {
            const res = await fetch("/api/service-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, rtomId: selectedRtomId, rtom: selectedRtom })
            });
            if (!res.ok) throw new Error("Failed to add order");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            toast.success("Order added successfully");
        },
        onError: () => toast.error("Error adding order")
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (data: any) => {
            const userId = localStorage.getItem("erp_user_id") || "";
            const res = await fetch("/api/service-orders", {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    "x-user-id": userId
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Status update failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            toast.success("Status updated successfully");
        },
        onError: () => toast.error("Failed to update status")
    });

    const scheduleMutation = useMutation({
        mutationFn: async ({ orderId, data }: { orderId: string, data: any }) => {
            const res = await fetch("/api/service-orders", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: orderId,
                    scheduledDate: data.date,
                    scheduledTime: data.time,
                    techContact: data.contactNumber
                })
            });
            if (!res.ok) throw new Error("Failed to schedule");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            toast.success("Scheduled successfully");
        },
        onError: () => toast.error("Error scheduling")
    });

    const commentMutation = useMutation({
        mutationFn: async ({ orderId, comment }: { orderId: string, comment: string }) => {
            const userId = localStorage.getItem("erp_user_id") || "";
            const res = await fetch("/api/service-orders", {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "x-user-id": userId
                },
                body: JSON.stringify({ id: orderId, comments: comment })
            });
            if (!res.ok) throw new Error("Failed to add comment");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
            toast.success("Comment added");
        },
        onError: () => toast.error("Error adding comment")
    });

    return {
        syncMutation,
        addOrderMutation,
        updateStatusMutation,
        scheduleMutation,
        commentMutation,
        isPending: syncMutation.isPending || addOrderMutation.isPending || updateStatusMutation.isPending || scheduleMutation.isPending || commentMutation.isPending
    };
}
