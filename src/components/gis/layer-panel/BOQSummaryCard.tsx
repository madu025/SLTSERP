import React from 'react';
import { Separator } from '@/components/ui/separator';
import { BOQData, BOQItem } from './types';

interface BOQSummaryCardProps {
  boq?: BOQData | null;
}

export function BOQSummaryCard({ boq }: BOQSummaryCardProps) {
  if (!boq) {
    return (
      <div className="text-center py-8 text-gray-500 text-xs">
        <p className="text-sm">No BOQ data available.</p>
        <p className="text-xs text-gray-400 mt-1">Import GIS files and process to generate BOQ.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Total Estimated Cost</span>
        <span className="text-lg font-bold text-green-700">
          LKR {boq.totalEstimated?.toLocaleString() || boq.totalEstimatedCost?.toLocaleString() || '0'}
        </span>
      </div>
      <Separator />
      <div className="space-y-1.5">
        {(boq.items || []).map((item: BOQItem, idx: number) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex-1">
              <span className="text-gray-700 font-medium">{item.description || item.itemCategory}</span>
              <span className="text-gray-400 ml-1">
                ({item.quantity} {item.unit} × LKR {item.unitRate?.toLocaleString()})
              </span>
            </div>
            <span className="font-medium text-gray-800 ml-2">
              LKR {item.amount?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {(!boq.items || boq.items.length === 0) && (
        <p className="text-xs text-gray-400 text-center py-2">No BOQ line items</p>
      )}

      <Separator />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{boq.items?.length || 0} line items</span>
        <span className="font-medium text-green-600">Auto-calculated from GIS data</span>
      </div>
    </div>
  );
}
