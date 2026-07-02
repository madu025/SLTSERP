"use client";

import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  Upload,
  MapPin,
  Zap,
  FileText,
  ChevronDown,
  Info,
} from 'lucide-react';
import React, { useState } from 'react';

const GISUpload = dynamic(
  () => import('@/components/gis/GISUpload').then((m) => ({ default: m.GISUpload })),
  { ssr: false }
);

const FEATURE_PILLS = [
  { icon: Zap, label: 'Auto-BOQ', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { icon: MapPin, label: 'OPMC Link', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { icon: FileText, label: 'Workflow', color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

const FORMATS = [
  { name: 'GeoJSON', ext: '.geojson .json' },
  { name: 'KML/KMZ', ext: '.kml .kmz' },
  { name: 'Shapefile', ext: '.shp' },
  { name: 'GeoPackage', ext: '.gpkg' },
  { name: 'QGIS', ext: '.qgz .qgs' },
];

const LAYER_HINTS = [
  { kw: '*Cables*', emoji: '🔌' },
  { kw: '*Poles*', emoji: '📡' },
  { kw: '*FDP*', emoji: '📦' },
  { kw: '*Fiber_Joint*', emoji: '🔗' },
  { kw: '*Road*', emoji: '🛣️' },
];

export default function GISUploadPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="erp-page-wrapper flex-row overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ─── Page Title ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  GIS Import Engine
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload GeoJSON / Shapefiles to auto-create projects, BOQs & workflows.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {FEATURE_PILLS.map(({ icon: Icon, label, color }) => (
                  <span
                    key={label}
                    className={`hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${color}`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ─── Main Upload Card ────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">Upload GIS Files</h2>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                  QGIS Snap v2
                </span>
              </div>
              <div className="p-5">
                <GISUpload />
              </div>
            </div>

            {/* ─── Collapsible Help Section ────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setHelpOpen((v) => !v)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Info className="w-4 h-4 text-slate-400" />
                  Help &amp; Supported Formats
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${helpOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {helpOpen && (
                <div className="px-5 pb-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* Formats */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
                      Supported Formats
                    </h4>
                    <div className="space-y-1.5">
                      {FORMATS.map((f) => (
                        <div key={f.name} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{f.name}</span>
                          <code className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {f.ext}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Layer naming */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
                      Auto-Detection by Filename
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {LAYER_HINTS.map((h) => (
                        <div
                          key={h.kw}
                          className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100"
                        >
                          <span>{h.emoji}</span>
                          <code className="font-mono text-[10px]">{h.kw}</code>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Example:{' '}
                      <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">
                        KL-SVK-0567_Cables.geojson
                      </code>{' '}
                      → CABLE layer
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
