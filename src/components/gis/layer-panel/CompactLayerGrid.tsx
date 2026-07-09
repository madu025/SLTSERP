import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface LayerRow {
  key: string;
  icon: string;
  label: string;
  color: string;
  count: number;
  metrics: { label: string; value: string }[];
}

interface CompactLayerGridProps {
  layers: LayerRow[];
  onViewDetails?: (section: string) => void;
}

export function CompactLayerGrid({ layers, onViewDetails }: CompactLayerGridProps) {
  if (layers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-xs">
        <p className="text-sm">No GIS layers available.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-500 uppercase w-8"></th>
            <th className="text-left py-2 px-1 font-semibold text-gray-500 uppercase">Layer</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-500 uppercase">Count</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-500 uppercase">Key Metrics</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((layer) => (
            <tr
              key={layer.key}
              className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors"
              onClick={() => onViewDetails?.(layer.key)}
            >
              <td className="py-2.5 px-3">
                <span
                  className="inline-block w-3 h-3 rounded-full ring-2 ring-offset-1"
                  style={{ backgroundColor: layer.color }}
                />
              </td>
              <td className="py-2.5 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{layer.icon}</span>
                  <span className="font-medium text-gray-800">{layer.label}</span>
                </div>
              </td>
              <td className="py-2.5 px-2 text-right">
                <Badge
                  variant="secondary"
                  className="text-xs font-bold"
                  style={{ backgroundColor: layer.color + '18', color: layer.color }}
                >
                  {layer.count > 0 ? layer.count : '-'}
                </Badge>
              </td>
              <td className="py-2.5 px-2">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {layer.metrics.map((m, idx) => (
                    <span key={idx} className="text-gray-500">
                      <span className="text-gray-400">{m.label}:</span>{' '}
                      <span className="font-medium text-gray-700">{m.value}</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
