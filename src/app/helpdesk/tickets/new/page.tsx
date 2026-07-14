"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTicketSchema } from "@/lib/validations/helpdesk.schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Info, Image as ImageIcon, X } from "lucide-react";
import { ITAsset } from "@/components/helpdesk/AssetList";
import { z } from "zod";
import Image from "next/image";

export default function CreateTicketPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; staffId?: string } | null>(null);
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.input<typeof CreateTicketSchema>>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: {
      assetId: "",
      category: "SOFTWARE_ISSUE" as const,
      description: "",
      priority: "MEDIUM" as const,
      anydeskId: "",
      photoUrls: [] as string[]
    }
  });

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const fetchUserAssets = async () => {
      if (!user?.id) return;
      setLoadingAssets(true);
      try {
        const custodianId = user.staffId || user.id;
        const res = await fetch(`/api/helpdesk/assets?assignedStaffId=${custodianId}`);
        if (!res.ok) throw new Error("Failed to fetch assets");
        const json = await res.json();
        if (json.success) {
          setAssets(json.data.assets || []);
        }
      } catch (err) {
        console.error("[TICKET-FORM] Failed to load user assets:", err);
        // Non-fatal — user can still create a ticket without linking a device
      } finally {
        setLoadingAssets(false);
      }
    };

    if (mounted && user?.id) {
      fetchUserAssets();
    }
  }, [mounted, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const urls: string[] = [...uploadedPhotos];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        const json = await res.json();
        if (json.url) {
          urls.push(json.url);
        }
      }
      setUploadedPhotos(urls);
      setValue("photoUrls", urls);
      toast.success("Screenshots uploaded successfully");
    } catch (err) {
      console.error("[TICKET-FORM] File upload failed:", err);
      toast.error("Failed to upload screenshots. Keep files under 10MB (images/PDFs only).");
    } finally {
      setUploadingFiles(false);
    }
  };

  const removePhoto = (idx: number) => {
    const next = uploadedPhotos.filter((_, i) => i !== idx);
    setUploadedPhotos(next);
    setValue("photoUrls", next);
  };

  const onSubmit = async (data: z.input<typeof CreateTicketSchema>) => {
    setSubmitting(true);
    try {
      // Structure fields correctly
      const payload = {
        ...data,
        assetId: data.assetId || null,
        anydeskId: data.anydeskId || null
      };

      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to create ticket");
      }

      const json = await res.json();
      if (json.success) {
        toast.success(`Support ticket ${json.data.ticketNumber} registered successfully!`);
        router.push("/helpdesk");
      }
    } catch (err) {
      console.error("[TICKET-FORM] Submit ticket failed:", err);
      toast.error("Failed to create support ticket. Please check inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground animate-fade-in">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[900px] mx-auto w-full space-y-6">
          {/* Header Section */}
          <div className="bg-card/70 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-foreground">Submit IT support ticket</h1>
                <p className="text-[10px] text-muted-foreground">Describe your hardware, software, or network issues.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.push("/helpdesk")}>
              Back to Portal
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border/50 rounded-xl p-5 md:p-6 shadow-xl space-y-4 text-xs">
            
            {/* Select Device */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Linked Device Asset
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-grow">
                  <Select onValueChange={(v) => setValue("assetId", v)}>
                    <SelectTrigger className="h-9.5 text-xs bg-muted/20 border-border/70">
                      <SelectValue placeholder={
                        loadingAssets
                          ? "Loading your assigned devices..."
                          : assets.length === 0
                          ? "No registered devices found — select if software-only issue"
                          : "Select one of your registered devices..."
                      } />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="">No Device / General software issue</SelectItem>
                      {assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.brand} {asset.model} (S/N: {asset.serialNumber}) [{asset.assetNumber}]
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!loadingAssets && assets.length === 0 && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                  <Info className="h-3.5 w-3.5" />
                  <span>No devices assigned to your account. Ask IT staff to register your device, or proceed without linking one.</span>
                </p>
              )}
              {!loadingAssets && assets.length > 0 && (
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  <span>Linking a registered asset helps us view repair timelines and specifications.</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Issue Category
                </label>
                <Select onValueChange={(v) => setValue("category", v as "PHYSICAL_DAMAGE" | "BROKEN_DISPLAY" | "PRINTER_ISSUE" | "NETWORK_ISSUE" | "SOFTWARE_ISSUE" | "EMAIL_ISSUE" | "EQUIPMENT_REQUEST" | "OTHER")} defaultValue="SOFTWARE_ISSUE">
                  <SelectTrigger className="h-9.5 text-xs bg-muted/20 border-border/70">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="PHYSICAL_DAMAGE">Physical Damage / Laptop broken</SelectItem>
                    <SelectItem value="BROKEN_DISPLAY">Broken Display Screen</SelectItem>
                    <SelectItem value="PRINTER_ISSUE">Printer offline / Ink failure</SelectItem>
                    <SelectItem value="NETWORK_ISSUE">VPN / WiFi / Internet connection</SelectItem>
                    <SelectItem value="SOFTWARE_ISSUE">Software / System lockups</SelectItem>
                    <SelectItem value="EMAIL_ISSUE">Outlook / Email sync problems</SelectItem>
                    <SelectItem value="EQUIPMENT_REQUEST">New Equipment Request</SelectItem>
                    <SelectItem value="OTHER">Other Technical Problem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Urgency / Priority
                </label>
                <Select onValueChange={(v) => setValue("priority", v as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")} defaultValue="MEDIUM">
                  <SelectTrigger className="h-9.5 text-xs bg-muted/20 border-border/70">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="LOW">Low (Non-blocking, local question)</SelectItem>
                    <SelectItem value="MEDIUM">Medium (Minor issues, workarounds exist)</SelectItem>
                    <SelectItem value="HIGH">High (Important, hampers daily workflow)</SelectItem>
                    <SelectItem value="CRITICAL">Critical (Total blocker, system down)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Problem Description
              </label>
              <Textarea
                {...register("description")}
                placeholder="Describe exactly what happened: error codes, when it started, steps to reproduce..."
                rows={5}
                className="text-xs bg-muted/20 border-border/70"
              />
              {errors.description && <p className="text-[10px] text-red-500">{errors.description.message}</p>}
            </div>

            {/* AnyDesk ID */}
            <div className="space-y-1.5 border border-primary/10 bg-primary/5 p-3 rounded-lg">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                AnyDesk Remote Address (Optional)
              </label>
              <Input
                {...register("anydeskId")}
                placeholder="e.g. 9-digit address"
                className="h-9 bg-card border-border/60 text-xs font-mono"
              />
              <p className="text-[9px] text-muted-foreground">If you require remote desktop support, enter your AnyDesk ID. The engineer can use this to connect immediately.</p>
            </div>

            {/* Attachment Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                Attach Screenshots or Photos
              </label>
              
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFiles}
                  className="h-8.5 text-xs gap-1.5 border-dashed relative cursor-pointer overflow-hidden bg-card"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>{uploadingFiles ? "Uploading..." : "Upload Screenshots"}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </Button>
                <span className="text-[10px] text-muted-foreground">Max 10MB per file. PNG, JPG, WEBP.</span>
              </div>

              {/* Photos List */}
              {uploadedPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {uploadedPhotos.map((url, idx) => (
                    <div key={idx} className="relative h-14 w-20 rounded border border-border bg-muted overflow-hidden">
                      <Image src={url} alt="screenshot" width={80} height={56} className="h-full w-full object-cover" unoptimized />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-700 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Block */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => router.push("/helpdesk")}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="h-9 text-xs text-white bg-primary">
                {submitting ? "Submitting..." : "Submit Support Ticket"}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
