// ============================================================================
// GISUpload Component - Drag-and-drop GIS file upload
// ============================================================================
// Enterprise-grade component for uploading GIS files (GeoJSON, KML, SHP, etc.)
// Supports per-file layer type detection and manual override for all 12 layers
// ============================================================================

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFileInfo[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });
  const [projectName, setProjectName] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [useRegionMultiplier, setUseRegionMultiplier] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

      if (projectName) formData.append('projectName', projectName);
      if (region) formData.append('region', region);
      if (district) formData.append('district', district);
      formData.append('useRegionMultiplier', useRegionMultiplier ? 'true' : 'false');
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
    } catch (err: any) {
      setUploadState({
        status: 'error',
        error: err.message || 'Upload failed',
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
  };

  const isValidGeoJSON = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['geojson', 'json', 'kml', 'kmz', 'shp', 'gpkg'].includes(ext || '');
  };

  return (
    <div className="space-y-6">
      {/* Project Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name (optional)
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., Kolonnawa SSD Phase 2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g., Western Province"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            District
          </label>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g., Colombo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="useRegionMultiplier"
            checked={useRegionMultiplier}
            onChange={(e) => setUseRegionMultiplier(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          />
          <label htmlFor="useRegionMultiplier" className="text-sm font-medium text-gray-700 cursor-pointer">
            Apply Region Cost Multiplier (↑rates for distant regions)
          </label>
        </div>
      </div>

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
    </div>
  );
}