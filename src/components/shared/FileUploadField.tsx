"use client";

import React, { useState, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle2, Loader2, Camera, X, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useFormContext } from "react-hook-form";

interface FileUploadFieldProps {
    label: string;
    description?: string;
    fieldName: string;
    onUpload: (file: File, fieldName: string) => Promise<string | null>;
    required?: boolean;
    accept?: string;
    allowCamera?: boolean;
}

export function FileUploadField({
    label,
    description,
    fieldName,
    onUpload,
    required,
    accept = "image/*",
    allowCamera = true
}: FileUploadFieldProps) {
    const { watch } = useFormContext();
    const value = watch(fieldName);
    
    const [isScanning, setIsScanning] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputId = `file-${fieldName}`;

    // Callback ref to reliably attach stream as soon as video element is mounted in Portal
    const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node && cameraStream) {
            node.srcObject = cameraStream;
            node.play().catch(e => console.warn("Video play failed", e));
        }
        videoRef.current = node;
    }, [cameraStream]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await uploadCapturedPhoto(file);
        }
    };

    const uploadCapturedPhoto = async (file: File) => {
        if (isScanning) return;
        try {
            setIsScanning(true);
            await onUpload(file, fieldName);
        } catch {
            toast.error(`Failed to upload ${label}`);
        } finally {
            setIsScanning(false);
        }
    };

    const startCamera = async () => {
        try {
            // Highly compatible constraints for both mobile and desktop
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            setCameraStream(stream);
            setIsCapturing(true);
        } catch (err) {
            console.error("[CAMERA-ERROR]", err);
            toast.error("Could not access camera. Check permissions.");
        }
    };

    const stopCamera = useCallback(() => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCapturing(false);
    }, [cameraStream]);

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current || !cameraStream) return;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            const vWidth = video.videoWidth;
            const vHeight = video.videoHeight;
            const cWidth = video.clientWidth;
            const cHeight = video.clientHeight;

            const frameWidth = cWidth * 0.85;
            const frameHeight = frameWidth * (63/100);
            
            const streamAspect = vWidth / vHeight;
            const containerAspect = cWidth / cHeight;
            const frameAspect = frameWidth / frameHeight;
            
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
                
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                stopCamera();

                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const file = new File([blob], `capture-${fieldName}-${Date.now()}.jpg`, { type: "image/jpeg" });
                await uploadCapturedPhoto(file);
            }
        } catch (err) {
            console.error("[CAPTURE-ERROR]", err);
            toast.error("Capture failed");
            setIsCapturing(false);
        }
    };

    return (
        <div className="space-y-4 p-5 rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-blue-200">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <Label htmlFor={inputId} className="text-[11px] font-black uppercase text-slate-900 tracking-wider">
                        {label} {required && <span className="text-red-500">*</span>}
                    </Label>
                    {description && <p className="text-[10px] text-slate-900 font-bold opacity-70 uppercase">{description}</p>}
                </div>
                
                {allowCamera && !isScanning && (
                    <button 
                        type="button" 
                        onClick={startCamera} 
                        className={cn(
                            "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2",
                            value 
                                ? "bg-slate-50 text-slate-900 border-slate-200" 
                                : "bg-blue-600 text-white border-blue-700 shadow-md active:scale-95"
                        )}
                    >
                        <Camera className="w-4 h-4" /> {value ? "RE-TAKE" : "TAKE PHOTO"}
                    </button>
                )}
            </div>

            <div className="relative group">
                <Input id={inputId} type="file" className="hidden" onChange={handleFileChange} accept={accept} />
                
                <Label
                    htmlFor={inputId}
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[140px] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                        value 
                            ? "border-emerald-500 bg-emerald-50/10" 
                            : "border-slate-200 bg-slate-50/50 hover:bg-white"
                    )}
                >
                    {value ? (
                        <div className="flex flex-col md:flex-row w-full h-full items-stretch p-4 gap-6">
                            <div className="relative w-full md:w-[200px] h-[120px] rounded-xl overflow-hidden border-2 border-slate-200 bg-white">
                                <Image src={value} alt={label} fill className="object-contain p-1" unoptimized priority />
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center space-y-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <ShieldCheck className="w-5 h-5" />
                                        <span className="text-[11px] font-black uppercase tracking-widest leading-none">Attached</span>
                                    </div>
                                    <p className="text-[10px] text-slate-900 font-bold uppercase opacity-80">
                                        File saved successfully.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">OK</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-6 text-slate-500">
                            <Upload className="w-8 h-8 text-slate-900 mb-1" />
                            <div className="text-center space-y-1">
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Upload Photo</span>
                                <p className="text-[9px] font-black text-slate-900 uppercase opacity-60">or drag and drop</p>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-10 border-2 border-blue-500 rounded-2xl">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                            <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] animate-pulse">Scanning Data...</span>
                        </div>
                    )}
                </Label>
            </div>

            <Dialog open={isCapturing} onOpenChange={(open) => !open && stopCamera()}>
                <DialogContent className="sm:max-w-4xl p-0 bg-slate-950 border-none rounded-none sm:rounded-[32px] overflow-hidden max-h-[100dvh] h-[100dvh] sm:h-auto">
                    <div className="relative h-full sm:aspect-video bg-black flex items-center justify-center overflow-hidden">
                        <video 
                            ref={setVideoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                        
                        {/* Binance KYC Layout Frame */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                            <div className="w-full max-w-[85%] aspect-[63/100] border-2 border-dashed border-white/40 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-blue-600 px-4 py-2 rounded-full shadow-xl">
                                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Align with Frame</span>
                                </div>
                                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-2xl" />
                            </div>
                        </div>

                        {/* Camera Controls */}
                        <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-12 px-10">
                            <button onClick={stopCamera} className="h-14 w-14 rounded-full bg-black/40 border-2 border-white/20 text-white flex items-center justify-center backdrop-blur-2xl hover:bg-black/60 transition-all active:scale-90">
                                <X className="w-6 h-6" />
                            </button>
                            <button onClick={capturePhoto} className="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-110 active:scale-90 group pointer-events-auto">
                                <div className="h-16 w-16 rounded-full border-4 border-slate-900 group-hover:border-blue-600 transition-colors" />
                            </button>
                            <div className="w-14 h-14" />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
