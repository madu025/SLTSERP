import React from 'react';

export function GISMapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-10 bg-white/95 backdrop-blur-sm border border-slate-200/85 shadow-xl rounded-xl p-3 w-56 text-[10px] select-none pointer-events-auto transition-all duration-300 hover:shadow-2xl hover:bg-white">
      <h4 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1.5 flex items-center gap-1">
        <span>🗺️</span> Map Legend
      </h4>
      <div className="space-y-2.5">
        {/* Layer Markers */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-green-700 shadow-sm animate-pulse" />
            <span className="text-slate-600 font-medium">Feed Point (Origin)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white shadow-sm" />
            <span className="text-slate-600 font-medium">FDP / Joint Box</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 ml-0.5" />
            <span className="text-slate-600 font-medium">Pole (CEB / SLT / New)</span>
          </div>
        </div>

        {/* Cable Fiber Counts */}
        <div className="border-t border-slate-100 pt-2">
          <h5 className="font-bold text-slate-500 mb-1.5 uppercase tracking-wider text-[8px]">
            ⚡ Fiber Count Colors
          </h5>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#e11d48]" />
              <span className="text-slate-600">4 Core (Rose)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#f97316]" />
              <span className="text-slate-600">8 Core (Org)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#eab308]" />
              <span className="text-slate-600">12 Core (Yel)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#16a34a]" />
              <span className="text-slate-600">24 Core (Grn)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#2563eb]" />
              <span className="text-slate-600">48 Core (Blu)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-1 rounded bg-[#9333ea]" />
              <span className="text-slate-600">96 Core+ (Pur)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
