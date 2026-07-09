// ============================================================================
// GIS Map Page - Project GIS visualization and management
// ============================================================================
// Displays GIS map view with layer controls, route stats, BOQ, and surveys
// for a specific project. Fetches data from the GIS API.
// ============================================================================

'use client';

import React, { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  GISMapView, 
  type GISRouteData, 
  type GISAssetData,
  type LayerVisibility,
  LAYER_COLORS,
  LAYER_LABELS,
  LAYER_ICONS
} from '@/components/gis/GISMapView';
import { GISLayerPanel } from '@/components/gis/GISLayerPanel';
import dynamic from 'next/dynamic';

const SurveyPointEditor = dynamic(
  () => import('@/components/gis/SurveyPointEditor').then((mod) => mod.SurveyPointEditor),
  { ssr: false }
);

interface Project {
  name?: string;
  projectCode?: string;
}
interface GISData {
  gisRoutes?: GISRouteData[];
  assets?: GISAssetData[];
  surveys?: unknown[];
  permits?: unknown[];
}

export default function ProjectGISMapPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gisData, setGisData] = useState<GISData | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'gis' | 'survey-edit'>('gis');
  const [preSurveyMode, setPreSurveyMode] = useState(false);
  const [preSurveyStart, setPreSurveyStart] = useState<[number, number] | null>(null);
  const [preSurveyEnd, setPreSurveyEnd] = useState<[number, number] | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    cables: true,
    poles: true,
    fdps: true,
    fiberJoints: true,
    chambers: true,
    roads: true,
    assets: true,
  });
  console.log("RENDER page.tsx state:", { preSurveyStart, preSurveyEnd });

  useEffect(() => {
    if (!preSurveyMode) {
      setPreSurveyStart(null);
      setPreSurveyEnd(null);
    }
  }, [preSurveyMode]);

  const fetchGISData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project details
      const projectRes = await fetch(`/api/projects/${id}`);
      if (!projectRes.ok) {
        throw new Error('Failed to load project details');
      }
      const projectData = await projectRes.json();
      setProject(projectData);

      // Fetch GIS data with cache-busting
      const gisRes = await fetch(`/api/gis?projectId=${id}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      if (!gisRes.ok) {
        // If GIS data isn't available yet, that's okay
        if (gisRes.status === 404) {
          setGisData(null);
        } else {
          throw new Error(`Failed to load GIS data: ${gisRes.statusText}`);
        }
      } else {
        const gisDataResult = await gisRes.json();
        setGisData(gisDataResult);
        if (gisDataResult.gisRoutes && gisDataResult.gisRoutes.length > 0) {
          const activeRoute = gisDataResult.gisRoutes.find((r: GISRouteData) => r.isActive);
          setSelectedRouteId(activeRoute ? activeRoute.id : gisDataResult.gisRoutes[0].id);
        }
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching GIS data:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load GIS data';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGISData();
  }, [fetchGISData]);

  const handleImportMore = useCallback(() => {
    router.push(`/gis/upload?projectId=${id}`);
  }, [router, id]);

  const handleViewDetails = useCallback((section: string) => {
    console.log(`View details for: ${section}`);
    // Could navigate to a specific route or show a modal
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const displayedRoute = gisData?.gisRoutes?.find((r: GISRouteData) => r.id === selectedRouteId) || gisData?.gisRoutes?.[0];
  const displayedRoutes = displayedRoute ? [displayedRoute] : [];
  
  // Extract the BOQ from the selected route
  const boq = displayedRoute?.generatedBOQs?.[0] || null;

  const handleRollback = async () => {
    if (!selectedRouteId || !displayedRoute) return;
    if (!confirm(`Are you sure you want to rollback and make v${displayedRoute.version} active?`)) return;

    try {
      setRollingBack(true);
      const res = await fetch(`/api/projects/${id}/gis/${selectedRouteId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback' })
      });
      
      if (!res.ok) throw new Error('Rollback failed');
      await fetchGISData();
    } catch (err) {
      console.error(err);
      alert('Failed to rollback route version.');
    } finally {
      setRollingBack(false);
    }
  };

  const handleRouteDeleted = useCallback((routeId: string) => {
    setGisData((prev) => {
      if (!prev || !prev.gisRoutes) return prev;
      return {
        ...prev,
        gisRoutes: prev.gisRoutes.filter((r) => r.id !== routeId)
      };
    });
    fetchGISData();
  }, [fetchGISData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-4xl">🗺️</p>
          <p className="text-lg font-medium text-red-700">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={fetchGISData} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
            <Button onClick={() => router.back()} variant="ghost">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const projectName = project?.name || project?.projectCode || 'Project';

  return (
    <div className={`min-h-screen bg-gray-50 ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className={`${fullscreen ? 'h-full flex flex-col' : 'w-full px-6 py-6'}`}>
        {/* Page Header */}
        <div className={`${fullscreen ? 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' : 'mb-6'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (fullscreen) {
                    setFullscreen(false);
                  } else {
                    router.push(`/projects/${id}`);
                  }
                }}
                className="text-gray-500 hover:text-gray-900 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {fullscreen ? 'Exit Fullscreen' : 'Back to Project'}
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">
                    GIS Map View
                  </h1>
                  <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    <button
                      onClick={() => setActiveTab('gis')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'gis'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🗺️ GIS Routes
                    </button>
                    <button
                      onClick={() => setActiveTab('survey-edit')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'survey-edit'
                          ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      ✏️ Point Editing
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {projectName}
                  {gisData?.gisRoutes && gisData.gisRoutes.length > 0 && (
                    <span className="ml-2">
                      · {gisData.gisRoutes.length} route{gisData.gisRoutes.length !== 1 ? 's' : ''}
                      · {(gisData.gisRoutes.reduce((sum: number, r: { poles?: unknown[] }) => sum + (r.poles?.length || 0), 0))} poles
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Horizontal Legend / Layer Visibility controls in the header */}
            {activeTab === 'gis' && (
              <div className="hidden lg:flex items-center gap-4 bg-slate-100/60 border border-slate-200/50 px-4 py-2 rounded-xl backdrop-blur-sm shadow-sm transition-all animate-in fade-in duration-500">
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1">Layers:</span>
                <div className="flex items-center gap-4">
                  {Object.entries(LAYER_LABELS).map(([key, label]) => {
                    const layerKey = key as keyof LayerVisibility;
                    const visible = layerVisibility[layerKey];
                    return (
                      <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => {
                            setLayerVisibility((prev) => ({
                              ...prev,
                              [layerKey]: !prev[layerKey]
                            }));
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="w-4 h-4 rounded-sm flex-shrink-0 flex items-center justify-center text-[10px]" style={{ backgroundColor: LAYER_COLORS[key] }}>
                          {LAYER_ICONS[key]}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">
                          {label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] text-gray-400">
                Updated: {lastRefreshed.toLocaleTimeString()}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchGISData}
                title="Refresh GIS data"
                className="text-gray-500 hover:text-gray-900"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className="text-gray-500 hover:text-gray-900"
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button size="sm" onClick={handleImportMore} className="gap-1.5">
                + Upgrade Route Version
              </Button>
            </div>
          </div>
        </div>

        {/* Version Selector */}
        {activeTab === 'gis' && gisData?.gisRoutes && gisData.gisRoutes.length > 1 && (
          <div className="mb-4 flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              🛣️ Route Version:
            </span>
            <select
              value={selectedRouteId || ''}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {gisData.gisRoutes.map((r: GISRouteData) => (
                <option key={r.id} value={r.id}>
                  v{r.version} - {r.versionType} {r.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
            {displayedRoute && !displayedRoute.isActive && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={handleRollback}
                disabled={rollingBack}
              >
                {rollingBack ? 'Rolling back...' : '🔄 Rollback to this version'}
              </Button>
            )}
          </div>
        )}

        {/* Main Content */}
        {activeTab === 'gis' ? (
          <div className={`${fullscreen ? 'flex-1 flex overflow-hidden relative bg-slate-50/30' : 'flex flex-col lg:flex-row gap-6 relative'}`}>
            {/* Map Section */}
            <div className={`transition-all duration-500 ease-in-out ${fullscreen ? 'flex-1 relative' : sidebarOpen ? 'lg:flex-[3.5]' : 'lg:flex-1 w-full'} min-h-[400px] ${fullscreen ? 'flex flex-col' : ''}`}>
              <div className={`relative bg-white/40 backdrop-blur-md shadow-xl border border-white/60 overflow-hidden ${fullscreen ? 'flex-1 rounded-none border-0' : 'h-[calc(100vh-180px)] min-h-[500px] rounded-2xl'}`}>
                <GISMapView
                  gisRoutes={displayedRoutes}
                  assets={gisData?.assets || []}
                  height={fullscreen ? '100%' : '100%'}
                  fullscreen={fullscreen}
                  preSurveyMode={preSurveyMode}
                  preSurveyStart={preSurveyStart}
                  preSurveyEnd={preSurveyEnd}
                  setPreSurveyStart={setPreSurveyStart}
                  setPreSurveyEnd={setPreSurveyEnd}
                  projectId={id}
                  onRouteSaved={fetchGISData}
                  layerVisibility={layerVisibility}
                  onLayerVisibilityChange={setLayerVisibility}
                />
                
                {/* Collapse / Expand Toggle Button for Sidebar */}
                <button
                  onClick={() => setSidebarOpen(prev => !prev)}
                  className={`absolute top-1/2 z-[1010] bg-white/90 backdrop-blur-lg hover:bg-white border border-slate-200/80 text-indigo-600 rounded-full w-9 h-9 shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-110 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    sidebarOpen ? (fullscreen ? 'right-[400px] -translate-y-1/2' : '-right-4.5 -translate-y-1/2') : 'right-4 -translate-y-1/2'
                  }`}
                  title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                  {sidebarOpen ? (
                    <span className="text-sm font-bold text-slate-600 transition-transform duration-300 group-hover:translate-x-0.5">▶</span>
                  ) : (
                    <span className="text-sm font-bold text-indigo-600 transition-transform duration-300 group-hover:-translate-x-0.5">◀</span>
                  )}
                </button>
              </div>
            </div>

            {/* Layer Panel Section */}
            {sidebarOpen && (
              <div className={`transition-all duration-500 ease-in-out ${fullscreen ? 'absolute right-4 top-4 bottom-4 w-96 z-[1005]' : 'lg:flex-1'}`}>
                <div className={`bg-white/70 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 p-4 ${fullscreen ? 'h-full overflow-y-auto' : 'h-[calc(100vh-180px)] min-h-[500px] overflow-y-auto'}`}>
                  <GISLayerPanel
                    gisRoutes={displayedRoutes}
                    assets={gisData?.assets || []}
                    boq={boq}
                    surveys={gisData?.surveys || []}
                    permits={gisData?.permits || []}
                    onImportMore={handleImportMore}
                    onViewDetails={handleViewDetails}
                    projectId={id}
                    preSurveyMode={preSurveyMode}
                    setPreSurveyMode={setPreSurveyMode}
                    preSurveyStart={preSurveyStart}
                    preSurveyEnd={preSurveyEnd}
                    setPreSurveyStart={setPreSurveyStart}
                    setPreSurveyEnd={setPreSurveyEnd}
                    onPreSurveyCreated={() => {
                      setPreSurveyStart(null);
                      setPreSurveyEnd(null);
                      fetchGISData();
                    }}
                    onRouteDeleted={handleRouteDeleted}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={fullscreen ? 'flex-1' : ''}>
            <SurveyPointEditor
              projectId={id}
              height={fullscreen ? '100%' : 'calc(100vh-180px)'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
