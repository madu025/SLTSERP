"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ImageIcon, FileText, Upload, CheckCircle2, Loader2, Camera, RefreshCw, X, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
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
    required = false
}: FileUploadFieldProps) {
    const inputId = `file-${fieldName}`;
    const [isCameraOpen, setIsCameraOpen] = React.useState(false);
    const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);

    // Robust stream attachment with retries
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
            await uploadFile(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File) => {
        const uploadedUrl = await onUpload(file, fieldName);
        if (uploadedUrl && onScan) {
            await onScan(uploadedUrl);
        }
    };

    const startCamera = async () => {
        try {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            }).catch(() => {
                return navigator.mediaDevices.getUserMedia({ video: true });
            });

            setCameraStream(stream);
            setIsCameraOpen(true);
        } catch (err) {
            console.error("Camera access error:", err);
            const msg = err instanceof Error ? err.message : "Unknown error";
            toast.error(`Camera error: ${msg}. If on iPhone, please ensure you use Safari or Chrome and allow permissions.`);
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

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], `capture-${fieldName}.jpg`, { type: "image/jpeg" });
                    await uploadFile(file);
                    stopCamera();
                }
                setIsCapturing(false);
            }, "image/jpeg", 0.9);
        }
    };

    return (
        <div className="space-y-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30 transition-all hover:border-blue-100 hover:bg-slate-50/50">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <Label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
                        {label} {required && <span className="text-red-500">*</span>}
                    </Label>
                    {description && <p className="text-xs text-slate-500">{description}</p>}
                </div>
                
                <div className="flex items-center gap-2">
                    {!value && (
                        <button 
                            type="button" 
                            onClick={startCamera} 
                            className="p-1 px-2.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all flex items-center gap-1.5"
                        >
                            <Camera className="w-3 h-3" /> Live Capture
                        </button>
                    )}
                    {value && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-100 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                        </div>
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
                        "relative flex flex-col items-center justify-center w-full min-h-[140px] rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                        value 
                            ? "border-green-200 bg-green-50/10" 
                            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
                    )}
                >
                    {value ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                            {value.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                <div className="relative w-full h-[120px] rounded-lg overflow-hidden border shadow-sm group-hover:opacity-50 transition-opacity">
                                    <Image src={value} alt={label} fill className="object-cover" unoptimized />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 text-blue-600">
                                    <FileText className="w-10 h-10" />
                                    <span className="text-xs font-semibold">PDF Document Attached</span>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                <div className="flex items-center gap-2 text-white text-xs font-bold">
                                    <Upload className="w-4 h-4" /> Change File
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-6 text-slate-400 group-hover:text-blue-500 transition-colors">
                            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-blue-100/50 transition-colors">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-semibold block">Click to Upload</span>
                                <span className="text-[10px] block opacity-60">PDF or JPG/PNG (Max 5MB)</span>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 animate-in fade-in">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                            <span className="text-xs font-bold text-blue-600 animate-pulse">Scanning with AI...</span>
                        </div>
                    )}

                    {!value && progress !== undefined && progress > 0 && progress < 100 && (
                        <div className="absolute inset-x-4 bottom-4 space-y-2">
                            <Progress value={progress} className="h-1.5" />
                            <p className="text-[10px] text-center font-bold text-blue-600">{progress}% Uploading...</p>
                        </div>
                    )}
                </Label>
            </div>

            <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black rounded-3xl border-none shadow-2xl">
                    <div className="relative aspect-[4/3] w-full bg-slate-900 group">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className="w-full h-full object-cover"
                        />
                        
                        {/* Binance style Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            <div className="w-[85%] h-[60%] border-2 border-white/50 rounded-2xl relative">
                                {/* Corners */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg" />
                                
                                <div className="absolute inset-0 bg-blue-500/5 animate-pulse flex items-center justify-center">
                                    <ShieldCheck className="w-12 h-12 text-white/20" />
                                </div>
                            </div>
                            <div className="mt-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                                <p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Align Document within Frame
                                </p>
                            </div>
                        </div>

                        {/* Camera Controls */}
                        <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-6">
                            <div className="flex items-center gap-6">
                                <Button 
                                    onClick={stopCamera} 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                                >
                                    <X className="w-6 h-6" />
                                </Button>
                                
                                <button 
                                    onClick={capturePhoto}
                                    disabled={isCapturing}
                                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-all bg-white/10"
                                >
                                    <div className={cn(
                                        "w-16 h-16 rounded-full bg-white transition-all group-hover:scale-110",
                                        isCapturing ? "animate-ping" : ""
                                    )} />
                                </button>

                                <Button 
                                    onClick={startCamera} 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                                >
                                    <RefreshCw className="w-6 h-6" />
                                </Button>
                            </div>
                        </div>

                        <div className="absolute top-4 right-4">
                            <DialogClose className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20">
                                <X className="w-5 h-5" />
                            </DialogClose>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-slate-950 text-center border-t border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Secure Artificial Intelligence Capture</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
