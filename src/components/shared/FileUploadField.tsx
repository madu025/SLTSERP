"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FileText, Upload, CheckCircle2, Loader2, Camera, RefreshCw, X, ShieldCheck, ImageIcon, Scan } from "lucide-react";
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
                toast.success("Document specimen digitized and synchronized");
                return uploadedUrl;
            }
        } catch (err) {
            console.error("Capture upload error:", err);
            toast.error("Failed to synchronize visual specimen");
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
            toast.error("Hardware synchronization failed. Grant camera access permissions.");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
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
                setIsCapturing(false);

                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const file = new File([blob], `capture-${fieldName}-${Date.now()}.jpg`, { type: "image/jpeg" });
                await uploadCapturedPhoto(file);
            }
        } catch (err) {
            console.error("Capture failure:", err);
            toast.error("Specimen capture failed");
            setIsCapturing(false);
        }
    };

    return (
        <div className="space-y-4 p-6 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200 group/main">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <Label htmlFor={inputId} className="text-[11px] font-black uppercase text-slate-900 tracking-widest block ml-0.5">
                        {label} {required && <span className="text-red-500 font-black">*</span>}
                    </Label>
                    {description && <p className="text-[10px] text-slate-900 font-bold leading-tight ml-0.5 opacity-90 group-hover/main:opacity-100 transition-opacity uppercase tracking-tight">{description}</p>}
                </div>
                
                <div className="flex items-center gap-2">
                    {allowCamera && !isScanning && (
                        <button 
                            type="button" 
                            onClick={startCamera} 
                            className={cn(
                                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2 shadow-sm",
                                value 
                                    ? "bg-slate-50 text-slate-900 border-slate-200 hover:bg-white" 
                                    : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:shadow-md"
                            )}
                        >
                            <Camera className="w-4 h-4" /> {value ? "RESYNC SPECIMEN" : "LIVE CAPTURE"}
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
                        "relative flex flex-col items-center justify-center w-full min-h-[160px] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                        value 
                            ? "border-emerald-500 bg-emerald-50/50" 
                            : "border-slate-200 bg-slate-50/50 hover:border-blue-500 hover:bg-white hover:shadow-sm"
                    )}
                >
                    {value ? (
                        <div className="flex flex-col md:flex-row w-full h-full items-stretch p-4 gap-6">
                            {/* Horizontal Image Section */}
                            <div className="relative w-full md:w-[240px] h-[140px] rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm transition-transform hover:scale-[1.02] bg-white bg-[url('/grid.svg')]">
                                <Image src={value} alt={label} fill className="object-contain p-2" unoptimized priority />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group/img hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Digital Specimen</span>
                                </div>
                            </div>
                            
                            {/* OCR & Status Section (Horizontal Context) */}
                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <ShieldCheck className="w-5 h-5" />
                                        <span className="text-[11px] font-black uppercase tracking-widest">OCR Verification Ready</span>
                                    </div>
                                    <p className="text-[10px] text-slate-900 font-bold uppercase tracking-tight leading-relaxed max-w-sm">
                                        Visual specimen successfully digitized and synchronized with SLTS national registry security protocols.
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-slate-200 text-slate-900 rounded-lg shadow-sm">
                                        <ImageIcon className="w-3 h-3 text-blue-600" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">8MP Resolution Target</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg shadow-sm">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[9px] font-black uppercase tracking-widest italic">SYNCHRONIZED</span>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-2">
                                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-900 shadow-sm hover:text-blue-600 transition-colors">
                                    <Upload className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-8 text-slate-400 group-hover:text-blue-600 transition-all">
                            <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl group-hover:border-blue-500 shadow-sm transition-all rotate-3 group-hover:rotate-0">
                                <Upload className="w-8 h-8 text-slate-900" />
                            </div>
                            <div className="text-center space-y-2">
                                <span className="text-[12px] font-black block text-slate-900 uppercase tracking-[0.2em]">Select Audit Specimen</span>
                                <div className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full shadow-lg">
                                    <FileText className="w-3 h-3" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">DRAG & DROP OFFICIAL DOCS</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-10 animate-in fade-in">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                <Scan className="absolute inset-0 m-auto w-5 h-5 text-blue-600 animate-pulse" />
                            </div>
                            <div className="text-center space-y-1">
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] block">OCR Audit Protocol Active</span>
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse italic">Synchronizing with registry...</span>
                            </div>
                        </div>
                    )}

                    {!value && progress !== undefined && progress > 0 && progress < 100 && (
                        <div className="absolute inset-x-12 bottom-8 space-y-3">
                            <Progress value={progress} className="h-1.5 bg-slate-100" />
                            <p className="text-[9px] text-center font-black text-blue-600 uppercase tracking-widest">{progress}% PACKET TRANSMISSION</p>
                        </div>
                    )}
                </Label>
            </div>
            
            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden bg-slate-900 rounded-2xl border-none shadow-2xl">
                    <div className="relative aspect-video w-full bg-black overflow-hidden group">
                        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
                            <div className={cn(
                                "relative border-2 border-white/20 transition-all duration-700 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]",
                                isVertical ? "w-[60%] aspect-[1/1.5]" : "w-[90%] aspect-[1.58/1]"
                            )}>
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500 -mt-0.5 -ml-0.5" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500 -mt-0.5 -mr-0.5" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500 -mb-0.5 -ml-0.5" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500 -mb-0.5 -mr-0.5" />
                            </div>
                        </div>

                        <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
                            <div className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg backdrop-blur-md">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <Button onClick={stopCamera} variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/10">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-6 z-10">
                            <div className="flex items-center gap-6">
                                <Button onClick={() => setIsVertical(!isVertical)} variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10">
                                    <RefreshCw className={cn("w-5 h-5 transition-transform", isVertical && "rotate-90")} />
                                </Button>
                                <button onClick={capturePhoto} disabled={isCapturing} className="h-16 w-16 rounded-full border-4 border-white/40 p-1 active:scale-95 transition-all">
                                    <div className="h-full w-full rounded-full bg-white shadow-xl" />
                                </button>
                                <div className="w-12 h-12" />
                            </div>
                            <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.4em]">Official Specimen Digitization Hub</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
