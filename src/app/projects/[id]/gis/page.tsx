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
import { GISMapView } from '@/components/gis/GISMapView';
import { GISLayerPanel } from '@/components/gis/GISLayerPanel';
import { SurveyPointEditor } from '@/components/gis/SurveyPointEditor';

interface Project {
  name?: string;
  projectCode?: string;
}
interface GISData {
  gisRoutes?: {
    poles?: unknown[];
    generatedBOQs?: unknown[];
  }[];
  assets?: unknown[];
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

      // Fetch GIS data
      const gisRes = await fetch(`/api/gis?projectId=${id}`);
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
    router.push('/gis/upload');
  }, [router]);

  const handleViewDetails = useCallback((section: string) => {
    console.log(`View details for: ${section}`);
    // Could navigate to a specific route or show a modal
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  // Extract the BOQ from the first generated BOQ
  const boq = gisData?.gisRoutes?.[0]?.generatedBOQs?.[0] || null;

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
      <div className={`${fullscreen ? 'h-full flex flex-col' : 'max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8'}`}>
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
                + Import GIS
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'gis' ? (
          <div className={`${fullscreen ? 'flex-1 flex overflow-hidden' : 'flex flex-col lg:flex-row gap-6'}`}>
            {/* Map Section */}
            <div className={`${fullscreen ? 'flex-1' : 'lg:flex-[3]'} min-h-[400px] ${fullscreen ? 'flex flex-col' : ''}`}>
              <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${fullscreen ? 'flex-1' : ''}`}>
                <GISMapView
                  gisRoutes={gisData?.gisRoutes || []}
                  assets={gisData?.assets || []}
                  height={fullscreen ? '100%' : '600px'}
                  fullscreen={fullscreen}
                />
              </div>
            </div>

            {/* Layer Panel Section */}
            <div className={`${fullscreen ? 'w-96 overflow-y-auto border-l border-gray-200 bg-white' : 'lg:flex-1'}`}>
              <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${fullscreen ? 'rounded-none border-0 h-full' : ''}`}>
                <GISLayerPanel
                  gisRoutes={gisData?.gisRoutes || []}
                  assets={gisData?.assets || []}
                  boq={boq}
                  surveys={gisData?.surveys || []}
                  permits={gisData?.permits || []}
                  onImportMore={handleImportMore}
                  onViewDetails={handleViewDetails}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={fullscreen ? 'flex-1' : ''}>
            <SurveyPointEditor
              projectId={id}
              height={fullscreen ? '100%' : '600px'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
