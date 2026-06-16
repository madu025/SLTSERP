// ============================================================================
// GIS Upload Page - File upload interface for GIS ingestion
// ============================================================================

import { GISUpload } from '@/components/gis/GISUpload';

export const metadata = {
  title: 'GIS Import - SLTS ERP',
  description: 'Upload and process GIS files for OSP project management',
};

export default function GISUploadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">GIS Import Engine</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload GeoJSON files from QGIS or other GIS tools to automatically create projects,
            generate BOQs, register assets, create survey tasks, and instantiate workflows.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-Detect</p>
                <p className="text-xs text-gray-500">Layer types & project type</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-BOQ</p>
                <p className="text-xs text-gray-500">Quantity & cost calculation</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Full Automation</p>
                <p className="text-xs text-gray-500">Assets, permits & workflow</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Component */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload GIS Files</h2>
          <GISUpload />
        </div>

        {/* Supported Formats */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Supported GIS Formats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'GeoJSON', ext: '.geojson, .json', desc: 'Native GIS format' },
              { name: 'KML', ext: '.kml', desc: 'Google Earth' },
              { name: 'KMZ', ext: '.kmz', desc: 'Compressed KML' },
              { name: 'Shapefile', ext: '.shp', desc: 'ESRI Shapefile' },
              { name: 'GeoPackage', ext: '.gpkg', desc: 'OGC Standard' },
              { name: 'QGIS', ext: '.qgz, .qgs', desc: 'QGIS Project' },
            ].map((fmt) => (
              <div key={fmt.name} className="text-center p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-900">{fmt.name}</p>
                <p className="text-xs text-gray-500">{fmt.ext}</p>
                <p className="text-xs text-gray-400">{fmt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Expected Layer Naming */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Expected Layer Naming</h2>
          <p className="text-sm text-gray-600 mb-4">
            Files are auto-detected by name. The system looks for these keywords in file names:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { pattern: '*Cables*', type: 'Fiber Cables', icon: '🔌' },
              { pattern: '*Poles*', type: 'Telecom Poles', icon: '📡' },
              { pattern: '*FDP*', type: 'Distribution Points', icon: '📦' },
              { pattern: '*Fiber_Joint*', type: 'Joint Closures', icon: '🔗' },
              { pattern: '*Road*', type: 'Road Segments', icon: '🛣️' },
            ].map((layer) => (
              <div key={layer.type} className="text-center p-3 bg-gray-50 rounded-md">
                <p className="text-lg">{layer.icon}</p>
                <p className="text-sm font-medium text-gray-900">{layer.pattern}</p>
                <p className="text-xs text-gray-500">{layer.type}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Example: <code className="bg-gray-100 px-1 rounded">KL-SVK-0567_Cables.geojson</code> → CABLE layer
          </p>
        </div>
      </div>
    </div>
  );
}
