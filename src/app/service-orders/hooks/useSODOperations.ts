"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ServiceOrder } from "@/types/service-order";

import { OrderCompletionData } from "@/components/modals/order-action/types";

interface ServiceOrdersResponse {
    items: ServiceOrder[];
    summary: {
        totalSod: number;
        contractorAssigned: number;
        appointments: number;
        statusBreakdown: Record<string, number>;
    };
}

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
        mutationFn: async (data: OrderCompletionData & { id: string }) => {
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
        onMutate: async (newData) => {
            await queryClient.cancelQueries({ queryKey: ["service-orders"] });
            const previousData = queryClient.getQueryData<ServiceOrdersResponse>(["service-orders"]);

            queryClient.setQueriesData<ServiceOrdersResponse>({ queryKey: ["service-orders"] }, (old) => {
                if (!old || !Array.isArray(old.items)) return old;
                return {
                    ...old,
                    items: old.items.map((item) => 
                        item.id === newData.id ? { ...item, ...newData } as ServiceOrder : item
                    )
                };
            });

            return { previousData };
        },
        onError: (err, newData, context: { previousData: ServiceOrdersResponse | undefined } | undefined) => {
            if (context?.previousData) {
                queryClient.setQueriesData({ queryKey: ["service-orders"] }, context.previousData);
            }
            toast.error("Failed to update status");
        },
        onSuccess: () => {
            toast.success("Status updated successfully");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
        }
    });

    const scheduleMutation = useMutation({
        mutationFn: async ({ orderId, data }: { orderId: string, data: { date: string, time: string, contactNumber?: string } }) => {
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
        onMutate: async ({ orderId, data }) => {
            await queryClient.cancelQueries({ queryKey: ["service-orders"] });
            const previousData = queryClient.getQueryData<ServiceOrdersResponse>(["service-orders"]);

            queryClient.setQueriesData<ServiceOrdersResponse>({ queryKey: ["service-orders"] }, (old) => {
                if (!old || !Array.isArray(old.items)) return old;
                return {
                    ...old,
                    items: old.items.map((item) => 
                        item.id === orderId 
                            ? { 
                                ...item, 
                                scheduledDate: data.date, 
                                scheduledTime: data.time, 
                                techContact: data.contactNumber ?? null 
                              } as ServiceOrder
                            : item
                    )
                };
            });

            return { previousData };
        },
        onError: (err, variables, context: { previousData: ServiceOrdersResponse | undefined } | undefined) => {
            if (context?.previousData) {
                queryClient.setQueriesData({ queryKey: ["service-orders"] }, context.previousData);
            }
            toast.error("Error scheduling");
        },
        onSuccess: () => {
            toast.success("Scheduled successfully");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
        }
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
        onMutate: async ({ orderId, comment }) => {
            await queryClient.cancelQueries({ queryKey: ["service-orders"] });
            const previousData = queryClient.getQueryData<ServiceOrdersResponse>(["service-orders"]);

            queryClient.setQueriesData<ServiceOrdersResponse>({ queryKey: ["service-orders"] }, (old) => {
                if (!old || !Array.isArray(old.items)) return old;
                return {
                    ...old,
                    items: old.items.map((item) => 
                        item.id === orderId ? { ...item, comments: comment } as ServiceOrder : item
                    )
                };
            });

            return { previousData };
        },
        onError: (err, variables, context: { previousData: ServiceOrdersResponse | undefined } | undefined) => {
            if (context?.previousData) {
                queryClient.setQueriesData({ queryKey: ["service-orders"] }, context.previousData);
            }
            toast.error("Error adding comment");
        },
        onSuccess: () => {
            toast.success("Comment added");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["service-orders"] });
        }
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
