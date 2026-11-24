"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUser, updateUser, deleteUser } from '@/actions/user-actions';
import { toErrorText } from '@/lib/error-text';

interface UserUpsertValues {
    id?: string;
    username: string;
    email: string;
    password?: string;
    name?: string;
    role: string;
    employeeId?: string;
    opmcIds?: string[];
    supervisorId?: string;
    assignedStoreId?: string;
    siteOfficeIds?: string[];
    status?: string;
    designations?: Array<{ sectionId: string; roleId: string; isPrimary?: boolean }>;
}

// The rules (role, designations, OPMC, status, password policy) are enforced once, on the server (UserAdminService);
// the form checks the same things only to give an early message.
export function useUserOperations() {
    const queryClient = useQueryClient();

    const upsertMutation = useMutation({
        mutationFn: async (values: UserUpsertValues) => {
            if (values.id) {
                return await updateUser({ ...values, id: values.id });
            }
            return await createUser(values);
        },
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["users"] });
                toast.success("User saved successfully");
            } else {
                toast.error(toErrorText(result.error) || "Error saving user");
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
                queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
                toast.success("User deleted");
            } else {
                toast.error(toErrorText(result.error) || "Error deleting user");
            }
        }
    });

    return {
        upsertMutation,
        removeMutation,
        isPending: upsertMutation.isPending || removeMutation.isPending
    };
}
