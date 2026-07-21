"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { ContractorSchema } from "@/lib/validations/contractor.schema";

interface ContractorFormSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Partial<ContractorSchema> & { id?: string };
    onSubmit: (data: ContractorSchema) => Promise<void>;
    isSubmitting: boolean;
}

// Simple schema for admin quick-add/edit
const adminContractorSchema = z.object({
    name: z.string().min(1, "Name is required"),
    contactNumber: z.string().min(9, "Valid contact number is required"),
    email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
    nic: z.string().min(10, "Valid NIC is required"),
    address: z.string().optional().nullable().or(z.literal("")),
    type: z.string(),
    status: z.string(),
    opmcId: z.string().optional().nullable(),
    bankName: z.string().optional().nullable().or(z.literal("")),
    bankAccountNumber: z.string().optional().nullable().or(z.literal("")),
});

export function ContractorFormSheet({
    open,
    onOpenChange,
    initialData,
    onSubmit,
    isSubmitting
}: ContractorFormSheetProps) {
    const form = useForm<z.infer<typeof adminContractorSchema>>({
        resolver: zodResolver(adminContractorSchema),
        defaultValues: {
            name: "",
            contactNumber: "",
            email: "",
            nic: "",
            address: "",
            type: "SOD",
            status: "ACTIVE",
            opmcId: "",
            bankName: "",
            bankAccountNumber: "",
        }
    });

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            form.reset({
                name: initialData.name || "",
                contactNumber: initialData.contactNumber || "",
                email: initialData.email || "",
                nic: initialData.nic || "",
                address: initialData.address || "",
                type: initialData.type || "SOD",
                status: initialData.status || "ACTIVE",
                opmcId: initialData.opmcId || "",
                bankName: initialData.bankName || "",
                bankAccountNumber: initialData.bankAccountNumber || "",
            });
        } else {
            form.reset({
                name: "",
                contactNumber: "",
                email: "",
                nic: "",
                address: "",
                type: "SOD",
                status: "ACTIVE",
                opmcId: "",
                bankName: "",
                bankAccountNumber: "",
            });
        }
    }, [open, initialData, form]);

    const handleSubmit = async (values: z.infer<typeof adminContractorSchema>) => {
        await onSubmit(values as unknown as ContractorSchema);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-6 overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>{initialData ? "Edit Contractor" : "Add Contractor"}</SheetTitle>
                    <SheetDescription>
                        {initialData ? "Update the contractor's profile details." : "Quickly register a new contractor."}
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="general">Profile Info</TabsTrigger>
                                <TabsTrigger value="bank">Bank Details</TabsTrigger>
                            </TabsList>

                            <TabsContent value="general" className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="E.g. J.S.N. Constructions" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="contactNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact No <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="07XXXXXXXX" {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="nic"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>NIC <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="NIC Number" {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="email@example.com" type="email" {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Full Address" {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type <span className="text-red-500">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="SOD">SOD</SelectItem>
                                                        <SelectItem value="OSP">OSP</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                                        <SelectItem value="PENDING">PENDING</SelectItem>
                                                        <SelectItem value="ARM_PENDING">ARM PENDING</SelectItem>
                                                        <SelectItem value="OSP_PENDING">OSP PENDING</SelectItem>
                                                        <SelectItem value="REJECTED">REJECTED</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="bank" className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="bankName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bank Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="E.g. BOC" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="bankAccountNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bank Account Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Account Number" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {initialData ? "Save Changes" : "Add Contractor"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
