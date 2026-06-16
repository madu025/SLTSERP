"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Validation Schema
const serviceOrderSchema = z.object({
    soNum: z.string().optional(), // Now optional for manual entries
    voiceNumber: z.string().optional(),
    customerName: z.string().optional(),
    techContact: z.string().optional(),
    status: z.enum(["INPROGRESS", "INSTALL_CLOSED"]),
    orderType: z.string().optional(),
    serviceType: z.string().optional(),
    package: z.string().optional(),
    dp: z.string().optional(),
    sales: z.string().optional(),
    address: z.string().optional(),
});

type ServiceOrderFormValues = z.infer<typeof serviceOrderSchema>;

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Previously we passed formData/setFormData, now purely handled via onSubmit
    onSubmit: (data: ServiceOrderFormValues) => void;
}

export default function ManualEntryModal({ isOpen, onClose, onSubmit }: ManualEntryModalProps) {
    const form = useForm<ServiceOrderFormValues>({
        resolver: zodResolver(serviceOrderSchema),
        defaultValues: {
            soNum: "",
            voiceNumber: "",
            customerName: "",
            techContact: "",
            status: "INPROGRESS",
            orderType: "",
            serviceType: "",
            package: "",
            dp: "",
            sales: "",
            address: "",
        },
    });

    const handleSubmit = (values: ServiceOrderFormValues) => {
        onSubmit(values); // Pass valid data up
        form.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Service Order</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="soNum"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SO Number (Optional for Manual)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter SO Number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="voiceNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Voice Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Voice Number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Customer Name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="techContact"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tech Contact</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Tech Contact" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="INPROGRESS">In Progress</SelectItem>
                                                <SelectItem value="INSTALL_CLOSED">Install Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="orderType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Order Type</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. CREATE" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="serviceType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Service Type</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. AB-CAB" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="package"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Package</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. TRIPLE_PLAY" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>DP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Distribution Point" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sales"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sales Person</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Sales Person" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem className="col-span-1 md:col-span-2">
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Customer Address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Add Service Order
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
