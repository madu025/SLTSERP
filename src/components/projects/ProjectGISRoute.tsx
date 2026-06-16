"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Route, Upload, Calculator, CheckCircle2, Download, MapIcon } from 'lucide-react';

interface ProjectGISRouteProps { project: any; }

export default function ProjectGISRoute({ project }: ProjectGISRouteProps) {
  const router = useRouter();
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRoutes(); }, [project.id]);

  const fetchRoutes = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/gis`);
      const data = await res.json();
      setRoutes(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleGenerateBOQ = async (routeId: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/gis/${routeId}/generate-boq`, { method: 'POST' });
      if (res.ok) fetchRoutes();
    } catch (err) { console.error(err); }
  };

  const handleOpenMapView = () => {
    router.push(`/projects/${project.id}/gis`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">GIS Route Design & Auto-BOQ</h3>
          <p className="text-sm text-slate-500">Import QGIS exports, auto-calculate quantities, generate BOQ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/gis/upload')}>
            <Upload className="w-4 h-4" /> Import GIS
          </Button>
          <Button variant="default" className="gap-2" onClick={handleOpenMapView}>
            <MapIcon className="w-4 h-4" /> Map View
          </Button>
        </div>
      </div>

      {/* Route Stats */}
      {routes.length > 0 && routes.map((route: any) => (
        <Card key={route.id} className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base">{route.name}</CardTitle>
                  <p className="text-sm text-slate-500">{route.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{route.status}</Badge>
                <Badge variant="outline">{route.routeLength ? `${(route.routeLength / 1000).toFixed(2)} km` : 'N/A'}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{route.calculatedPoles || route.poles?.length || 0}</p>
                <p className="text-xs text-blue-600">Poles</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{route.chambers?.length || 0}</p>
                <p className="text-xs text-green-600">Chambers</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-700">{route.closures?.length || 0}</p>
                <p className="text-xs text-purple-600">Closures</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-700">{route.cableSegments?.length || 0}</p>
                <p className="text-xs text-amber-600">Cable Segments</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-rose-700">
                  {route.routeLength ? `ceil(${(route.routeLength / (route.poleSpacing || 50)).toFixed(1)})` : '-'}
                </p>
                <p className="text-xs text-rose-600">Auto Poles</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleGenerateBOQ(route.id)}>
                <Calculator className="w-4 h-4 mr-1" /> Generate Auto-BOQ
              </Button>
              <Button size="sm" variant="outline" onClick={handleOpenMapView}>
                <MapIcon className="w-4 h-4 mr-1" /> View on Map
              </Button>
              {route.gisGeneratedBOQs?.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> BOQ Generated
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {routes.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No GIS routes imported yet</p>
            <Button className="mt-4" variant="outline" onClick={() => router.push('/gis/upload')}>
              <Upload className="w-4 h-4 mr-2" /> Import Route
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
