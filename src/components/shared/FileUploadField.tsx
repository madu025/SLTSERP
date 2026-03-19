"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FileText, Upload, CheckCircle2, Loader2, Camera, RefreshCw, X, ShieldCheck, Zap, Scan, ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FileUploadFieldProps {
    label: string;
    description?: string;
    value?: string | null;
    fieldName: string;
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    progress?: number;
    accept?: string;
    isScanning?: boolean;
    onScan?: (url: string) => Promise<void>;
    required?: boolean;
    allowCamera?: boolean;
}

export function FileUploadField({
    label,
    description,
    value,
    fieldName,
    onUpload,
    progress,
    accept = "image/*,application/pdf",
    isScanning,
    onScan,
    required = false,
    allowCamera = true
}: FileUploadFieldProps) {
    const inputId = `file-${fieldName}`;
    const [isCameraOpen, setIsCameraOpen] = React.useState(false);
    const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);
    const [isVertical, setIsVertical] = React.useState(false);

    // Ensure camera stream is attached when dialog opens or stream changes
    const attachStream = React.useCallback(() => {
        let attempts = 0;
        const maxAttempts = 10;
        
        const tryAttach = () => {
            if (videoRef.current && cameraStream && isCameraOpen) {
                videoRef.current.srcObject = cameraStream;
                videoRef.current.play().catch((err) => {
                    console.warn("[CAMERA-PLAY-RETRY]", err);
                    if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(tryAttach, 100);
                    }
                });
            } else if (attempts < maxAttempts && isCameraOpen) {
                attempts++;
                setTimeout(tryAttach, 100);
            }
        };
        
        tryAttach();
    }, [isCameraOpen, cameraStream]);

    React.useEffect(() => {
        if (isCameraOpen && cameraStream) {
            attachStream();
        }
    }, [isCameraOpen, cameraStream, attachStream]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const uploadedUrl = await onUpload(e.target.files[0], fieldName);
            if (uploadedUrl && onScan) {
                await onScan(uploadedUrl);
            }
        }
    };

    const uploadCapturedPhoto = async (file: File) => {
        try {
            const uploadedUrl = await onUpload(file, fieldName);
            if (uploadedUrl) {
                if (onScan) await onScan(uploadedUrl);
                toast.success("Identity snapshot uploaded successfully");
                return uploadedUrl;
            }
        } catch (err) {
            console.error("Capture upload error:", err);
            toast.error("Failed to synchronize captured specimen");
        }
        return null;
    };

    const startCamera = async () => {
        try {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            }).catch(() => {
                return navigator.mediaDevices.getUserMedia({ video: true });
            });

            setCameraStream(stream);
            setIsCameraOpen(true);
        } catch (err) {
            console.error("Camera access error:", err);
            const msg = err instanceof Error ? err.message : "Portal error";
            toast.error(`Capture Error: ${msg}. Grant camera permissions for identity synchronization.`);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        setIsCapturing(true);

        try {
            const video = videoRef.current;
            const canvas = document.createElement("canvas");
            const vWidth = video.videoWidth;
            const vHeight = video.videoHeight;
            const cWidth = video.clientWidth;
            const cHeight = video.clientHeight;
            const frameAspect = isVertical ? (1 / 1.5) : (1.58 / 1);
            const padding = window.innerWidth < 640 ? 48 : 96;
            const availableWidth = cWidth - padding;
            const frameWidth = isVertical ? (availableWidth * 0.75) : availableWidth;
            const frameHeight = frameWidth / frameAspect;
            const streamAspect = vWidth / vHeight;
            const containerAspect = cWidth / cHeight;
            
            let drawWidth = vWidth;
            let drawHeight = vHeight;
            let offsetX = 0;
            let offsetY = 0;

            if (streamAspect > containerAspect) {
                drawWidth = vHeight * containerAspect;
                offsetX = (vWidth - drawWidth) / 2;
            } else {
                drawHeight = vWidth / containerAspect;
                offsetY = (vHeight - drawHeight) / 2;
            }

            const scaleX = drawWidth / cWidth;
            const scaleY = drawHeight / cHeight;
            const cropWidth = frameWidth * scaleX;
            const cropHeight = frameHeight * scaleY;
            const cropX = offsetX + (cWidth - frameWidth) / 2 * scaleX;
            const cropY = offsetY + (cHeight - frameHeight) / 2 * scaleY;

            canvas.width = 1200;
            canvas.height = canvas.width / frameAspect;
            
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
                stopCamera();
                setIsCameraOpen(false);
                setIsCapturing(false);

                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const file = new File([blob], `capture-${fieldName}-${Date.now()}.jpg`, { type: "image/jpeg" });
                await uploadCapturedPhoto(file);
            }
        } catch (err) {
            console.error("Capture failure:", err);
            toast.error("Failed to synchronize visual specimen");
            setIsCapturing(false);
        }
    };

    return (
        <div className="space-y-6 p-8 rounded-[40px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl transition-all hover:bg-white/[0.05] hover:border-blue-500/20 shadow-2xl ring-1 ring-white/5 group/main">
            <div className="flex justify-between items-start gap-4">
                <div className="space-y-2">
                    <Label htmlFor={inputId} className="text-sm font-black text-white uppercase tracking-[0.2em] ml-1">
                        {label} {required && <span className="text-emerald-500">*</span>}
                    </Label>
                    {description && <p className="text-[11px] text-slate-400 font-bold leading-relaxed ml-1 opacity-70 group-hover/main:opacity-100 transition-opacity">{description}</p>}
                </div>
                
                <div className="flex items-center gap-3">
                    {allowCamera && !isScanning && (
                        <button 
                            type="button" 
                            onClick={startCamera} 
                            className={cn(
                                "h-10 px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 shadow-xl border",
                                value 
                                    ? "bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30" 
                                    : "bg-slate-900 text-slate-500 border-white/5 hover:bg-blue-600/20 hover:text-blue-400 hover:border-blue-500/20"
                            )}
                        >
                            <Camera className="w-3.5 h-3.5" /> {value ? "RESYNC SPECIMEN" : "LIVE CAPTURE"}
                        </button>
                    )}
                </div>
            </div>

            <div className="relative group">
                <Input
                    id={inputId}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={accept}
                />
                
                <Label
                    htmlFor={inputId}
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[180px] rounded-[32px] border-2 border-dashed transition-all cursor-pointer overflow-hidden isolate shadow-2xl",
                        value 
                            ? "border-emerald-500/30 bg-slate-950/20" 
                            : "border-white/10 bg-slate-950/40 hover:border-blue-500/50 hover:bg-slate-950/60"
                    )}
                >
                    {value ? (
                        <div className="relative w-full min-h-[200px] flex flex-col items-center justify-center p-4 bg-transparent rounded-[28px] overflow-hidden group/thumb">
                            {value.match(/\.(jpg|jpeg|png|webp|gif|svg|avif)/i) || value.includes('amazonaws.com') || value.includes('cloudfront.net') || value.includes('data:image') ? (
                                <div className="relative w-full h-[180px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl group-hover/thumb:opacity-20 transition-opacity bg-slate-900">
                                    <Image 
                                        src={value} 
                                        alt={label} 
                                        fill 
                                        className="object-contain" 
                                        unoptimized 
                                        priority
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 py-10 text-blue-400">
                                    <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                                        <FileText className="w-10 h-10" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.4em] bg-blue-500/20 px-5 py-1.5 rounded-full border border-blue-500/30 ring-1 ring-white/10 shadow-2xl">Verified PDF Specimen</span>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all">
                                <div className="flex items-center gap-3 text-white text-[11px] font-black uppercase tracking-widest bg-blue-600 px-6 py-3 rounded-2xl shadow-2xl border border-white/20">
                                    <Upload className="w-4 h-4" /> Change Registry File
                                </div>
                            </div>

                            {/* Verified Badge */}
                            <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 z-10 animate-in zoom-in duration-500">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">READY</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-5 py-10 text-slate-600 group-hover:text-blue-500 transition-all">
                            <div className="relative">
                                <div className="p-6 bg-white/5 rounded-[24px] group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all border border-white/10 shadow-2xl relative z-10">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-center space-y-2">
                                <span className="text-sm font-black block text-white tracking-tight italic">TRANSMIT FILE</span>
                                <span className="text-[10px] block font-black text-slate-600 uppercase tracking-[0.3em]">Registry Format: PDF / JPG / PNG • MAX 5MB</span>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-20 animate-in fade-in">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                            </div>
                            <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.5em] animate-pulse">Advanced AI Synchronizing...</span>
                        </div>
                    )}

                    {!value && progress !== undefined && progress > 0 && progress < 100 && (
                        <div className="absolute inset-x-8 bottom-8 space-y-4">
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-blue-600 w-full animate-pulse" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[10px] text-center font-black text-blue-400 uppercase tracking-[0.4em]">{progress}% UPLOADING</p>
                        </div>
                    )}
                </Label>
            </div>
        </div>
    );
}
