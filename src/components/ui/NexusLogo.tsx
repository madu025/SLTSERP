"use client";

import React from 'react';
import Image from 'next/image';

interface NexusLogoIconProps {
  size?: number;
  className?: string;
  showGlow?: boolean;
}

/**
 * High-Precision Icon Badge for SLTS Nexus
 * Renders the exact 1-to-1 approved trademark-free 3D network knot artwork
 */
export function NexusLogoIcon({ size = 32, className = "", showGlow = true }: NexusLogoIconProps) {
  return (
    <div 
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 ${
        showGlow ? 'shadow-[0_0_14px_rgba(0,174,239,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]' : ''
      } transition-all duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Subtle Breathing Fiber Pulse Outer Border (Clean, non-radar) */}
      <div className="absolute -inset-[1.5px] rounded-full border border-cyan-400/50 animate-pulse pointer-events-none z-10 shadow-[0_0_8px_rgba(0,174,239,0.4)]" />

      {/* Inner Image Container Badge */}
      <div className="relative w-full h-full rounded-full overflow-hidden z-0 border border-cyan-500/40">
        <Image 
          src="/logo-icon.png"
          alt="SLTS Nexus Logo"
          width={size * 2}
          height={size * 2}
          priority
          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
        />
      </div>
    </div>
  );
}

interface NexusLogoMasterProps {
  iconSize?: number;
  className?: string;
  subtitle?: string;
}

/**
 * High-Precision Master Branding Lockup for SLTS Nexus (Header & Login Page)
 */
export function NexusLogoMaster({ iconSize = 36, className = "", subtitle = "WORKFLOW MANAGEMENT SYSTEM" }: NexusLogoMasterProps) {
  const isLarge = iconSize >= 48;
  const isExtraLarge = iconSize >= 56;

  const titleSizeClass = isExtraLarge 
    ? "text-3xl md:text-4xl font-black" 
    : isLarge 
      ? "text-2xl font-black" 
      : "text-xl font-black";

  const subtitleSizeClass = isExtraLarge 
    ? "text-xs tracking-[0.25em] mt-1.5" 
    : isLarge 
      ? "text-[11px] tracking-[0.24em] mt-1.5" 
      : "text-[9.5px] tracking-[0.22em] mt-1";

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <NexusLogoIcon size={iconSize} showGlow={true} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 leading-none">
          <span className={`${titleSizeClass} tracking-wider text-white`}>SLTS</span>
          <span className={`${titleSizeClass} tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400`}>
            NEXUS
          </span>
        </div>
        {subtitle && (
          <span className={`${subtitleSizeClass} font-bold uppercase text-sky-400/90 leading-none`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default NexusLogoMaster;


