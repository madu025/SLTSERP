"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Maximize2,
    Minimize2,
    BookOpen,
    Layers,
    X,
    ExternalLink
} from "lucide-react";

import { SLIDES } from "./slides";



export default function PresentationPage() {
    const router = useRouter();
    const [currentSlide, setCurrentSlide] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isOutlineOpen, setIsOutlineOpen] = useState<boolean>(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const playTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);

    const slidesLength = SLIDES.length;

    // Check auth status locally to customize CTA button
    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = document.cookie.split("; ").find(row => row.startsWith("token="));
            const savedSlide = localStorage.getItem("sltserp_presentation_slide");

            setTimeout(() => {
                setIsLoggedIn(!!token);
                if (savedSlide) {
                    const index = parseInt(savedSlide, 10);
                    if (index >= 0 && index < slidesLength) {
                        setCurrentSlide(index);
                    }
                }
            }, 0);
        }
    }, [slidesLength]);

    // Save active slide progress
    useEffect(() => {
        localStorage.setItem("sltserp_presentation_slide", String(currentSlide));
    }, [currentSlide]);

    const goToSlide = useCallback((index: number) => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide(index);
        // Reset transition lock after animation completes
        setTimeout(() => setIsTransitioning(false), 350);
    }, [isTransitioning]);

    const handleNext = useCallback(() => {
        goToSlide((currentSlide + 1) % slidesLength);
    }, [currentSlide, slidesLength, goToSlide]);

    const handlePrev = useCallback(() => {
        goToSlide((currentSlide - 1 + slidesLength) % slidesLength);
    }, [currentSlide, slidesLength, goToSlide]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const diffX = touchStartX.current - touchEndX.current;
        const minSwipeDistance = 50;

        if (diffX > minSwipeDistance) {
            handleNext();
        } else if (diffX < -minSwipeDistance) {
            handlePrev();
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    // Autoplay logic
    useEffect(() => {
        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                handleNext();
            }, 6000);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }
        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isPlaying, handleNext]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                handleNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrev();
            } else if (e.key === "Escape") {
                if (isFullscreen) {
                    setIsFullscreen(false);
                }
                if (isOutlineOpen) {
                    setIsOutlineOpen(false);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNext, handlePrev, isFullscreen, isOutlineOpen]);

    // Fullscreen toggle with cross-browser support
    const toggleFullscreen = useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;

        try {
            if (!document.fullscreenElement && !(document as unknown as Record<string, unknown>).webkitFullscreenElement) {
                // Enter fullscreen with vendor prefixes
                if (el.requestFullscreen) {
                    await el.requestFullscreen();
                } else if ((el as unknown as Record<string, unknown>).webkitRequestFullscreen) {
                    await (el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
                } else if ((el as unknown as Record<string, unknown>).msRequestFullscreen) {
                    await (el as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
                }
            } else {
                // Exit fullscreen with vendor prefixes
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as unknown as Record<string, unknown>).webkitExitFullscreen) {
                    await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
                } else if ((document as unknown as Record<string, unknown>).msExitFullscreen) {
                    await (document as unknown as { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
                }
            }
        } catch (err) {
            console.warn("Fullscreen request failed:", err);
        }
    }, []);

    // Monitor fullscreen change from browser (e.g. Esc key) — with vendor prefix support
    useEffect(() => {
        const handleFsChange = () => {
            const isFs = !!(
                document.fullscreenElement ||
                (document as unknown as Record<string, unknown>).webkitFullscreenElement ||
                (document as unknown as Record<string, unknown>).msFullscreenElement
            );
            setIsFullscreen(isFs);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        document.addEventListener("webkitfullscreenchange", handleFsChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFsChange);
            document.removeEventListener("webkitfullscreenchange", handleFsChange);
        };
    }, []);

    // Close outline when clicking outside
    useEffect(() => {
        if (!isOutlineOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-outline-panel]")) {
                setIsOutlineOpen(false);
            }
        };
        // Delay to avoid closing immediately from the toggle button click
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOutlineOpen]);

    const slide = SLIDES[currentSlide];
    const ActiveSlideComponent = slide.component;
    const SlideIcon = slide.icon;

    return (
        <div
            ref={containerRef}
            className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col overflow-hidden relative font-sans select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)"
            }}
        >
            {/* Inline custom-scrollbar styles */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                    border-radius: 9999px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569;
                }

                @keyframes slideInFromLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideInFromRight {
                    from { transform: translateX(30px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeSlideOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .slide-in-left {
                    animation: slideInFromLeft 0.3s ease-out forwards;
                }
                .slide-content-enter {
                    animation: slideInFromRight 0.35s ease-out forwards;
                }
            `}</style>

            {/* Background glowing decorations */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

            {/* HEADER */}
            <header className="flex-none px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex items-center gap-2.5">
                    <span className="bg-gradient-to-r from-blue-600 to-emerald-500 text-white p-1.5 rounded-lg">
                        <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>
                    <div>
                        <h1 className="text-[10px] sm:text-xs font-black tracking-widest uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            SLTSERP
                        </h1>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tight font-semibold">Features Showcase</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Show outline index"
                        aria-label="Toggle slide outline"
                    >
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        <span className="hidden sm:inline">Outline</span>
                    </button>

                    <button
                        onClick={() => {
                            if (isLoggedIn) {
                                router.push("/dashboard");
                            } else {
                                router.push("/login");
                            }
                        }}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        aria-label="Open ERP Portal"
                    >
                        <span>ERP Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 min-h-0 flex overflow-hidden relative">
                {/* Backdrop overlay when outline is open */}
                {isOutlineOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30"
                        onClick={() => setIsOutlineOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* SLIDE OUTLINE SIDEBAR (Drawer) */}
                {isOutlineOpen && (
                    <div
                        data-outline-panel
                        className="absolute inset-y-0 left-0 w-[90vw] max-w-[340px] bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between z-40 shadow-2xl backdrop-blur-md slide-in-left"
                    >
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">Slide Index</span>
                                <button
                                    onClick={() => setIsOutlineOpen(false)}
                                    className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    aria-label="Close outline"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-[calc(100dvh-140px)] custom-scrollbar pr-1">
                                {SLIDES.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            goToSlide(idx);
                                            setIsOutlineOpen(false);
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${currentSlide === idx
                                                ? "bg-blue-600 text-white font-bold"
                                                : "text-slate-400 hover:bg-slate-900 hover:text-white"
                                            }`}
                                    >
                                        <span className="font-mono text-[9px] opacity-65">{s.id < 10 ? '0' : ''}{s.id}</span>
                                        <span className="truncate">{s.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-600 border-t border-slate-800 pt-3 font-mono">
                            Press Left/Right keys to navigate slides
                        </div>
                    </div>
                )}

                {/* SLIDE CANVAS */}
                <div
                    ref={contentAreaRef}
                    className="flex-1 flex flex-col p-2 sm:p-6 md:p-8 items-center justify-center overflow-y-auto custom-scrollbar"
                >
                    {/* Slide container (Glassmorphic) */}
                    <div className="w-full max-w-[95vw] xl:max-w-7xl bg-slate-900/50 border border-slate-800 p-4 sm:p-8 lg:p-10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col justify-between min-h-[calc(100dvh-185px)] lg:min-h-[550px]">

                        {/* Slide Top Details */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                            <div className="flex items-center gap-2">
                                <SlideIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
                                    {slide.chapter}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-black text-slate-500 font-mono bg-slate-950/60 px-2.5 py-0.5 rounded-full border border-slate-800">
                                {slide.id < 10 ? '0' : ''}{slide.id} / {slidesLength}
                            </span>
                        </div>

                        {/* Slide Core Content */}
                        <div className="flex-1 flex flex-col justify-center py-2 sm:py-4 md:py-6">
                            {/* Slide Title & Subtitle */}
                            <div className="mb-4 sm:mb-6 md:mb-8 slide-content-enter" key={`title-${slide.id}`}>
                                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                                    {slide.title}
                                </h2>
                                <p className="text-xs sm:text-sm lg:text-base text-slate-400 mt-1 sm:mt-2 leading-relaxed font-medium">
                                    {slide.subtitle}
                                </p>
                            </div>

                            {/* Render Custom React Content */}
                            <div className="flex-1 flex flex-col justify-center slide-content-enter" key={`content-${slide.id}`}>
                                <ActiveSlideComponent />
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* FOOTER CONTROLS */}
            <footer className="flex-none px-2 sm:px-6 py-2 sm:py-4 border-t border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky bottom-0 z-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-3">
                    <button
                        onClick={handlePrev}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Previous Slide"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`p-2 rounded-lg border border-slate-800/80 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900 ${isPlaying ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-900/60"
                            }`}
                        title={isPlaying ? "Pause Autoplay" : "Autoplay (6s interval)"}
                        aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}
                    >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isPlaying ? "Pause" : "Play"}</span>
                    </button>

                    <button
                        onClick={handleNext}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title="Next Slide"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center gap-1 max-w-md w-full mx-2 sm:mx-6 bg-slate-950/80 p-1.5 rounded-full border border-slate-800 overflow-x-auto custom-scrollbar">
                    {SLIDES.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => goToSlide(idx)}
                            className={`h-1.5 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${currentSlide === idx
                                    ? "bg-gradient-to-r from-blue-500 to-emerald-400 flex-1"
                                    : "bg-slate-800 hover:bg-slate-700 w-3"
                                }`}
                            title={`Jump to Slide ${s.id}: ${s.title}`}
                            aria-label={`Go to slide ${s.id}: ${s.title}`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900/60 border border-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}