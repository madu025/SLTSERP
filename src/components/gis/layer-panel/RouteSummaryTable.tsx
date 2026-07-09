import React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RouteData } from './types';

interface RouteSummaryTableProps {
  routes: RouteData[];
  onDeleteRoute?: (routeId: string) => void;
}

export function RouteSummaryTable({ routes, onDeleteRoute }: RouteSummaryTableProps) {
  if (!routes || routes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-xs">
        <p className="text-sm">No GIS routes imported yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase">Route Name</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Length (km)</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Poles</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Chambers</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Closures</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Cables</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="py-2 px-2 font-medium text-gray-800">{route.name}</td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.routeLength ? (route.routeLength / 1000).toFixed(2) : '0.00'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.poles?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.chambers?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.closures?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right text-gray-700">
                {route.cableSegments?.length || '-'}
              </td>
              <td className="py-2 px-2 text-right">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    route.status === 'COMPLETED' ? 'border-green-300 text-green-700 bg-green-50' :
                    route.status === 'IMPORTED' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                    'border-yellow-300 text-yellow-700 bg-yellow-50'
                  }`}
                >
                  {route.status || 'IMPORTED'}
                </Badge>
              </td>
              <td className="py-2 px-2 text-right">
                <button
                  type="button"
                  onClick={(e) => {
                    console.log("ROUTE TABLE ON CLICK", route.id);
                    e.stopPropagation();
                    e.preventDefault();
                    onDeleteRoute?.(route.id);
                  }}
                  className="text-red-500 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded transition-colors"
                  title="Delete Route"
                >
                  <Trash2 className="w-3.5 h-3.5 inline-block" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
