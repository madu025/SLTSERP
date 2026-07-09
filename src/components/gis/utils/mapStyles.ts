import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

export interface LayerVisibility {
  cables: boolean;
  poles: boolean;
  fdps: boolean;
  fiberJoints: boolean;
  chambers: boolean;
  roads: boolean;
  assets: boolean;
}

export const LAYER_COLORS: Record<string, string> = {
  cables: '#2563eb',
  poles: '#2563eb', // Blue for new/planned poles (consistent with rendering convention)
  fdps: '#7c3aed',
  fiberJoints: '#ca8a04',
  chambers: '#0891b2',
  roads: '#64748b',
  assets: '#10b981',
};

export const LAYER_LABELS: Record<string, string> = {
  cables: 'Cables',
  poles: 'Poles',
  fdps: 'FDPs',
  fiberJoints: 'Joints',
  chambers: 'Chambers',
  roads: 'Roads',
  assets: 'Assets',
};

export const LAYER_ICONS: Record<string, string> = {
  cables: '🔌',
  poles: '📡',
  fdps: '📦',
  fiberJoints: '🔗',
  chambers: '🕳️',
  roads: '🛣️',
  assets: '📍',
};

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createPolylineStyle(color: string, weight: number, opacity: number, dashArray?: string) {
  return new Style({
    stroke: new Stroke({ color, width: weight, lineDash: dashArray ? dashArray.split(',').map(Number) : undefined }),
  });
}

export function createCircleStyle(color: string, radius: number, fillOpacity: number, dashArray?: string) {
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: hexToRgba(color, fillOpacity) }),
      stroke: new Stroke({ color, width: 2, lineDash: dashArray ? dashArray.split(',').map(Number) : undefined }),
    }),
  });
}

export function createHoverPolylineStyle(color: string) {
  return new Style({ stroke: new Stroke({ color, width: 5 }) });
}

export function createHoverCircleStyle(color: string, radius: number) {
  return new Style({
    image: new CircleStyle({ radius, fill: new Fill({ color: hexToRgba(color, 0.9) }), stroke: new Stroke({ color, width: 2 }) }),
  });
}

export const getLayerStyles = () => ({
  cables: createPolylineStyle(LAYER_COLORS.cables, 3, 0.8),
  cablesHover: createHoverPolylineStyle(LAYER_COLORS.cables),
  poles: createCircleStyle(LAYER_COLORS.poles, 8, 0.6),
  polesHover: createHoverCircleStyle(LAYER_COLORS.poles, 10),
  fdps: createCircleStyle(LAYER_COLORS.fdps, 10, 0.6),
  fdpsHover: createHoverCircleStyle(LAYER_COLORS.fdps, 12),
  fiberJoints: createCircleStyle(LAYER_COLORS.fiberJoints, 7, 0.6),
  fiberJointsHover: createHoverCircleStyle(LAYER_COLORS.fiberJoints, 9),
  chambers: createCircleStyle(LAYER_COLORS.chambers, 6, 0.7, '2,2'),
  chambersHover: createHoverCircleStyle(LAYER_COLORS.chambers, 8),
  roads: createPolylineStyle(LAYER_COLORS.roads, 2, 0.5, '8,6'),
  roadsHover: createHoverPolylineStyle(LAYER_COLORS.roads),
  assets: createCircleStyle(LAYER_COLORS.assets, 6, 0.7, '2,2'),
  assetsHover: createHoverCircleStyle(LAYER_COLORS.assets, 8),
});

export const MEASURE_STYLE = new Style({
  fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
  stroke: new Stroke({ color: '#f59e0b', width: 3, lineDash: [8, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#f59e0b' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

export const MEASURE_SEGMENT_STYLE = new Style({
  stroke: new Stroke({ color: '#f59e0b', width: 3, lineDash: [8, 4] }),
});

export function getCableColorByFiberCount(fiberCount?: number | string | null): string {
  if (fiberCount == null) return '#2563eb'; // Default Blue
  const count = typeof fiberCount === 'string' ? parseInt(fiberCount, 10) : fiberCount;
  if (isNaN(count)) return '#2563eb';
  
  switch (count) {
    case 1: return '#a8a29e'; // Stone / Grey
    case 2: return '#a8a29e'; // Stone / Grey
    case 4: return '#e11d48'; // Rose / Pink-red
    case 8: return '#f97316'; // Orange
    case 12: return '#eab308'; // Yellow
    case 24: return '#16a34a'; // Green
    case 48: return '#2563eb'; // Blue
    case 96: return '#9333ea'; // Purple
    default:
      if (count > 48) return '#7c3aed'; // Dark Purple
      if (count > 24) return '#0284c7'; // Light Blue
      if (count > 12) return '#0d9488'; // Teal
      return '#2563eb';
  }
}
