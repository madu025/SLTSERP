"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { publicRegistrationSchema, PublicRegistrationSchema } from "@/lib/validations/contractor.schema";
import { ContractorRegistrationApi } from "@/services/api/contractor-registration.api";
import { toast } from "sonner";
import { useOCR } from "./useOCR";
import { safe } from "@/utils/safe-await.util";
import { ErrorUtil } from "@/utils/error.util";

export function useContractorRegistration(token: string) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [staticData, setStaticData] = useState<{ 
        banks: { id: string; name: string }[], 
        branches: { id: string; name: string }[], 
        stores: { id: string; name: string }[], 
        opmcs: { id: string; name: string; rtom: string }[] 
    }>({
        banks: [], branches: [], stores: [], opmcs: []
    });
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [submitted, setSubmitted] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const { scanImage } = useOCR();

    const form = useForm<PublicRegistrationSchema>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(publicRegistrationSchema) as any,
        defaultValues: {
            name: "",
            nic: "",
            address: "",
            contactNumber: "",
            brNumber: "",
            bankName: "",
            bankBranch: "",
            bankAccountNumber: "",
            bankPassbookUrl: "",
            teams: [{ name: "Default Team", primaryStoreId: "", members: [] }],
            photoUrl: "",
            nicFrontUrl: "",
            nicBackUrl: "",
            policeReportUrl: "",
            gramaCertUrl: "",
            brCertUrl: "",
            registrationFeeSlipUrl: ""
        }
    });

    // Auto-save logic
    const lastSavedData = useRef<string>("");
    const watchAllFields = useWatch({ control: form.control });
    
    useEffect(() => {
        const timer = setTimeout(async () => {
            const currentDataStr = JSON.stringify(watchAllFields);
            if (currentDataStr !== lastSavedData.current && !loading && !submitting && !submitted && !error) {
                const [err] = await safe(ContractorRegistrationApi.saveDraft(token, watchAllFields as Partial<PublicRegistrationSchema>));
                if (err) {
                    console.error("[AUTO-SAVE] Failed to save draft:", err);
                } else {
                    lastSavedData.current = currentDataStr;
                    console.log("[AUTO-SAVE] Draft saved successfully");
                }
            }
        }, 5000); // Auto-save after 5 seconds of inactivity
        
        return () => clearTimeout(timer);
    }, [watchAllFields, token, loading, submitting, submitted, error]);

    // Initial load
    useEffect(() => {
        if (!token) return;

        const init = async () => {
            const [err, results] = await safe(Promise.all([
                ContractorRegistrationApi.getContractorByToken(token),
                ContractorRegistrationApi.getStaticData()
            ]));

            if (err || !results) {
                console.error("[useContractorRegistration] Init failed:", err);
                const parsedError = ErrorUtil.parseError(err)['error'];
                if (parsedError === 'ALREADY_SUBMITTED') {
                    setSubmitted(true);
                } else if (parsedError === 'INVALID_TOKEN' || parsedError === 'TOKEN_EXPIRED') {
                    setError(parsedError as string);
                } else {
                    setError('UNKNOWN_ERROR');
                }
                setLoading(false);
                return;
            }

            const [contractor, meta] = results;
            setStaticData(meta);
            
            // Prefill form
            const draft = contractor.registrationDraft || {};
            form.reset({
                ...form.getValues(),
                ...draft,
                name: contractor.name || draft.name || "",
                nic: contractor.nic || draft.nic || "",
                address: contractor.address || draft.address || "",
                contactNumber: contractor.contactNumber || draft.contactNumber || "",
                brNumber: contractor.brNumber || draft.brNumber || "",
                bankName: contractor.bankName || draft.bankName || "",
                bankBranch: contractor.bankBranch || draft.bankBranch || "",
                bankAccountNumber: contractor.bankAccountNumber || draft.bankAccountNumber || "",
                bankPassbookUrl: contractor.bankPassbookUrl || draft.bankPassbookUrl || "",
            });
            
            lastSavedData.current = JSON.stringify(form.getValues());
            if (contractor.registrationDraft) toast.info("Previous progress restored");
            setLoading(false);
        };

        init();
    }, [token, form]);

    const handleUpload = async (file: File, fieldName: string) => {
        const [err, url] = await safe(ContractorRegistrationApi.uploadFile(file, fieldName, (p: number) => {
            setUploadProgress(prev => ({ ...prev, [fieldName]: p }));
        }));
        
        if (err || !url) {
            toast.error(`Upload failed for ${fieldName}`);
            return null;
        }

        form.setValue(fieldName as keyof PublicRegistrationSchema, url, { shouldValidate: true });
        toast.success(`${fieldName.replace('Url', '')} uploaded successfully`);

        // Start OCR process using the existing useOCR hook pattern
        if (fieldName === 'nicFrontUrl' || fieldName === 'nicBackUrl' || fieldName === 'bankPassbookUrl') {
            const [scanErr, result] = await safe(scanImage(url, fieldName));
            if (scanErr) {
                toast.error(`OCR failed for ${fieldName}`);
            } else if (result) {
                if (fieldName === 'nicFrontUrl' || fieldName === 'nicBackUrl') {
                    form.setValue('nic', result as string, { shouldValidate: true });
                    toast.success("NIC details updated from photo");
                } else if (fieldName === 'bankPassbookUrl') {
                    form.setValue('bankAccountNumber', result as string, { shouldValidate: true });
                    toast.success("Account details updated from photo");
                }
            }
        }

        return url;
    };

    const nextStep = async () => {
        // Trigger validation for current step fields if needed
        setStep(prev => prev + 1);
        window.scrollTo(0, 0);
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const onSubmit = async (values: PublicRegistrationSchema) => {
        setSubmitting(true);
        
        const [err] = await safe(ContractorRegistrationApi.submitRegistration(token, values));
        if (err) {
            toast.error(err.message || "Failed to submit application");
        } else {
            setSubmitted(true);
            toast.success("Application submitted successfully!");
        }
        
        setSubmitting(false);
    };

    return {
        form,
        step,
        loading,
        submitting,
        submitted,
        error,
        staticData,
        uploadProgress,
        nextStep,
        prevStep,
        handleUpload,
        handleRegistrationSubmit: onSubmit
    };
}
