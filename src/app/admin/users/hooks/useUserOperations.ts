"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUser, updateUser, deleteUser } from '@/actions/user-actions';
import { z } from 'zod';

const userSchema = z.object({
    username: z.string().min(3, "Username required"),
    email: z.string().email("Invalid email"),
    password: z.string().optional(),
    name: z.string().min(2, "Name required"),
    role: z.string(),
    employeeId: z.string().optional(),
    opmcIds: z.array(z.string()),
    supervisorId: z.string().optional(),
    assignedStoreId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export function useUserOperations() {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: async (values: UserFormValues & { id?: string }) => {
            if (values.id) {
                return await updateUser({ ...values, id: values.id });
            } else {
                return await createUser(values);
            }
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                toast.success("User saved successfully");
            } else {
                toast.error(result.error || "Error saving user");
            }
        },
        onError: () => toast.error("Error saving user")
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            return await deleteUser(id);
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                toast.success("User deleted");
            } else {
                toast.error(result.error || "Error deleting user");
            }
        }
    });

    return {
        upsertMutation,
        removeMutation,
        isPending: upsertMutation.isPending || removeMutation.isPending
    };
}
