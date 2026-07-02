// ============================================================================
// GISUpload Component - Drag-and-drop GIS file upload
// ============================================================================
// Enterprise-grade component for uploading GIS files (GeoJSON, KML, SHP, etc.)
// Supports per-file layer type detection and manual override for all 12 layers
// ============================================================================

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SELECTABLE_LAYER_TYPES,
  LAYER_TYPE_LABELS,
  LAYER_NAME_MAPPING,
  type GISLayerType,
} from '@/types/gis';

interface UploadFileInfo {
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  layerType: GISLayerType; // detected or user-overridden
  autoDetected: boolean; // true if auto-detected, false if user-overridden
}

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  importId?: string;
  message?: string;
  error?: string;
  progress: number;
}

interface OPMC {
  id: string;
  name: string;
  rtom: string;
  region: string;
}

interface CompactProject {
  id: string;
  projectCode: string;
  name: string;
  createdAt: string | Date;
  opmc?: OPMC | null;
}

/**
 * Client-side layer type detection from file name.
 * Mirrors the server-side gisParser.detectLayerType logic.
 */
function detectLayerTypeFromFileName(fileName: string): GISLayerType {
  const normalized = fileName
    .replace(/\.(geojson|json|kml|kmz|shp|gpkg|qgz|qgs)$/i, '')
    .replace(/^KL-SVK-\d+_/, '')
    .replace(/^.*[\\/]/, '');

  for (const [pattern, layerType] of Object.entries(LAYER_NAME_MAPPING)) {
    if (normalized.toLowerCase().includes(pattern.toLowerCase())) {
      return layerType;
    }
  }
  return 'UNKNOWN';
}

export function GISUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const upgradeProjectId = searchParams.get('projectId');
  const [upgradeProject, setUpgradeProject] = useState<CompactProject | null>(null);
  const [versionType, setVersionType] = useState<'PLANNED' | 'FIELD_CHANGE' | 'AS_BUILT'>('FIELD_CHANGE');
  const [notes, setNotes] = useState('');

  const [files, setFiles] = useState<UploadFileInfo[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });
  const [projectName, setProjectName] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [opmcs, setOpmcs] = useState<OPMC[]>([]);
  const [selectedOpmcId, setSelectedOpmcId] = useState('');
  const [lea, setLea] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [existingProjects, setExistingProjects] = useState<CompactProject[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string; code: string } | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects?status=COMPLETED&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setExistingProjects(data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, []);

  React.useEffect(() => {
    fetch('/api/opmcs')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOpmcs(data);
        }
      })
      .catch((err) => console.error('Error loading OPMCs:', err));

    fetchProjects();

    if (upgradeProjectId) {
      fetch(`/api/projects/${upgradeProjectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.id) {
            setUpgradeProject(data);
          }
        })
        .catch((err) => console.error('Error loading upgrade project:', err));
    }
  }, [fetchProjects, upgradeProjectId]);

  const handleDeleteProject = (id: string, name: string, code: string) => {
    setProjectToDelete({ id, name, code });
  };

  const executeDelete = async (id: string, name: string) => {
    try {
      setUploadState({
        status: 'processing',
        message: `Deleting project ${name}...`,
        progress: 50,
      });

      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': 'ADMIN',
        },
      });

      const data = await res.json();
      if (res.ok) {
        setUploadState({
          status: 'idle',
          progress: 0,
        });
        setExistingProjects((prev) => prev.filter((p) => p.id !== id));
        alert(`Project "${name}" was deleted successfully.`);
        fetchProjects();
      } else {
        throw new Error(data.error || 'Failed to delete project');
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Failed to delete project';
      setUploadState({
        status: 'error',
        error: errMsg,
        progress: 0,
      });
    }
  };

  const handleOpmcChange = (opmcId: string) => {
    setSelectedOpmcId(opmcId);
    const selected = opmcs.find((o) => o.id === opmcId);
    if (selected) {
      setRegion(selected.region);
      setDistrict(selected.name); // OPMC Name represents the district/exchange station
    } else {
      setRegion('');
      setDistrict('');
    }
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: UploadFileInfo[] = Array.from(newFiles).map((file) => {
      const detected = detectLayerTypeFromFileName(file.name);
      return {
        file,
        status: 'pending' as const,
        layerType: detected,
        autoDetected: true,
      };
    });
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLayerTypeChange = useCallback((index: number, newType: GISLayerType) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index
          ? { ...f, layerType: newType, autoDetected: false }
          : f
      )
    );
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploadState({ status: 'uploading', progress: 0 });

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      // Pass per-file layer types as a parallel JSON array
      formData.append(
        'layerTypes',
        JSON.stringify(files.map((f) => f.layerType))
      );

      if (upgradeProjectId) {
        formData.append('projectId', upgradeProjectId);
        formData.append('versionType', versionType);
        if (notes) formData.append('notes', notes);
      } else {
        if (projectName) formData.append('projectName', projectName);
        if (region) formData.append('region', region);
        if (district) formData.append('district', district);
        if (lea) formData.append('lea', lea);
        formData.append('useRegionMultiplier', 'false');
        formData.append('isCompletedProject', 'true');
      }
      
      formData.append('createdById', 'current-user'); // Replace with actual user ID

      // Upload files
      const uploadRes = await fetch('/api/gis/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || errData.message || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      setUploadState({ status: 'processing', importId: uploadData.importId, progress: 50, message: 'Files uploaded. Processing...' });

      // Process the import
      const processRes = await fetch('/api/gis/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: uploadData.importId }),
      });

      if (!processRes.ok) {
        const errData = await processRes.json();
        throw new Error(errData.error || errData.message || 'Processing failed');
      }

      const processData = await processRes.json();

      setUploadState({
        status: 'completed',
        importId: uploadData.importId,
        progress: 100,
        message: `GIS import completed successfully! Project: ${processData.result.projectCode}`,
      });

      // Clear files
      setFiles([]);
      
      if (upgradeProjectId) {
        setTimeout(() => {
          router.push(`/projects/${upgradeProjectId}/gis`);
        }, 2000);
      } else {
        fetchProjects();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState({
        status: 'error',
        error: errMsg,
        progress: 0,
      });
    }
  };

  const handleReset = () => {
    setUploadState({ status: 'idle', progress: 0 });
    setFiles([]);
    setProjectName('');
    setRegion('');
    setDistrict('');
    setSelectedOpmcId('');
    setLea('');
  };

  const isValidGeoJSON = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['geojson', 'json', 'kml', 'kmz', 'shp', 'gpkg'].includes(ext || '');
  };

  return (
    <div className="space-y-6">
      {/* Project Details */}
      {upgradeProjectId ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔄</span>
            <div>
              <h2 className="text-lg font-bold text-blue-900">Route Version Upgrade</h2>
              <p className="text-sm text-blue-700">
                Uploading a new version for project: <strong className="font-mono">{upgradeProject?.projectCode || upgradeProjectId}</strong>
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-1">
                Version Reason / Type
              </label>
              <select
                value={versionType}
                onChange={(e) => setVersionType(e.target.value as 'PLANNED' | 'FIELD_CHANGE' | 'AS_BUILT')}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
              >
                <option value="FIELD_CHANGE">Field Change / Revision</option>
                <option value="PLANNED">Planned (Draft Update)</option>
                <option value="AS_BUILT">As-Built (Finalized)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Version Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Revised path due to road construction"
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name (optional)
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Kolonnawa SSD Phase 2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              OPMC / RTOM Station
            </label>
            <select
              value={selectedOpmcId}
              onChange={(e) => handleOpmcChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
            >
              <option value="">-- Select OPMC --</option>
              {opmcs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rtom} - {o.name} ({o.region})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Local Exchange Area (LEA)
            </label>
            <input
              type="text"
              value={lea}
              onChange={(e) => setLea(e.target.value)}
              placeholder="e.g., LEA-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Region & District (Auto-filled)
            </label>
            <input
              type="text"
              value={region && district ? `${region} / ${district}` : 'Select OPMC first'}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
          ${uploadState.status === 'uploading' || uploadState.status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".geojson,.json,.kml,.kmz,.shp,.gpkg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            GeoJSON, KML, KMZ, SHP, GeoPackage (Max 50MB per file)
          </p>
          <p className="text-xs text-gray-400">
            Supports all 12 SLT template layers: Cables, Poles, FDP, Fiber Joints, Roads/EOP, Ducts, Handholes, Manholes, ODF, Risers, FTC, Test Points, Buildings
          </p>
        </div>
      </div>

      {/* File List with Layer Type Override */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Selected Files ({files.length}) — Layer types auto-detected, override if needed
          </h3>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {files.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md text-sm gap-3"
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isValidGeoJSON(f.file.name) ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-gray-700 truncate max-w-xs" title={f.file.name}>
                    {f.file.name}
                  </span>
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    ({(f.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.autoDetected && f.layerType !== 'UNKNOWN' && (
                    <span className="text-xs text-blue-500 italic">auto</span>
                  )}
                  <select
                    value={f.layerType}
                    onChange={(e) => handleLayerTypeChange(idx, e.target.value as GISLayerType)}
                    className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
                  >
                    <option value="UNKNOWN">— Auto / Unknown —</option>
                    {SELECTABLE_LAYER_TYPES.map((lt) => (
                      <option key={lt} value={lt}>
                        {LAYER_TYPE_LABELS[lt]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                    disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadState.status === 'uploading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Uploading files...</span>
            <span className="text-gray-500">{uploadState.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      )}

      {uploadState.status === 'processing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{uploadState.message}</span>
            <span className="text-gray-500">{uploadState.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {uploadState.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Upload Failed</p>
              <p className="text-sm text-red-700 mt-1">{uploadState.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {uploadState.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">Import Successful</p>
              <p className="text-sm text-green-700 mt-1">{uploadState.message}</p>
              {uploadState.importId && (
                <p className="text-xs text-green-600 mt-1">
                  Import ID: {uploadState.importId}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {uploadState.status === 'idle' || uploadState.status === 'error' ? (
          <button
            onClick={handleUpload}
            disabled={files.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Upload & Process
          </button>
        ) : null}

        {(uploadState.status === 'completed' || uploadState.status === 'error') && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Start New Import
          </button>
        )}
      </div>

      {/* Existing Uploaded Projects List */}
      {!upgradeProjectId && existingProjects.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>🗂️</span> Active &amp; Imported Projects ({existingProjects.length})
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Project Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Project Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Region / OPMC</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Created At</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {existingProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs font-bold text-slate-700">{p.projectCode}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {p.opmc?.region || 'N/A'} - {p.opmc?.name || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteProject(p.id, p.name, p.projectCode)}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 border border-red-200 hover:border-red-400 rounded bg-red-50 hover:bg-red-100 transition-colors"
                        disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
                      >
                        🗑️ Delete Project
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4 border border-slate-100 transform scale-100 transition-all duration-300">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold">Delete Project</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 text-left">
              Are you sure you want to permanently delete the project <strong className="text-gray-900">&quot;{projectToDelete.name}&quot; ({projectToDelete.code})</strong>?
              <br /><br />
              This will completely erase all associated GIS routes, cables, poles, joints, chambers, generated BOQs, milestones, and field tasks from the system.
              <br /><br />
              <span className="text-red-600 font-semibold">This action cannot be undone.</span>
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={uploadState.status === 'processing'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { id, name } = projectToDelete;
                  setProjectToDelete(null);
                  await executeDelete(id, name);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                disabled={uploadState.status === 'processing'}
              >
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}