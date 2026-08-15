import { GISLayerType } from './core.types';
export interface ParsedCableData {
  layerName: string;
  featureCount: number;
  totalLength: number; // meters
  cableType: string;
  fiberCount: number;
  segments: CableSegment[];
}
export interface CableSegment {
  index: number;
  coordinates: [number, number][];
  length: number; // meters
  cableType?: string;
  fiberCount?: number;
  fromPoint?: [number, number];
  toPoint?: [number, number];
  properties?: Record<string, string | number | boolean | null | undefined>;
}
export interface ParsedPoleData {
  layerName: string;
  featureCount: number;
  poles: PoleItem[];
}
export interface PoleItem {
  index: number;
  latitude: number;
  longitude: number;
  elevation?: number;
  poleType?: string;
  height?: number;
  properties: Record<string, string | number | boolean | null | undefined>;
}
export interface ParsedFDPData {
  layerName: string;
  featureCount: number;
  fdps: FDPItem[];
}
export interface FDPItem {
  index: number;
  latitude: number;
  longitude: number;
  fdpCode?: string;
  portCount?: number;
  splitters?: number;
  properties: Record<string, string | number | boolean | null | undefined>;
}
export interface ParsedFiberJointData {
  layerName: string;
  featureCount: number;
  joints: FiberJointItem[];
}
export interface FiberJointItem {
  index: number;
  latitude: number;
  longitude: number;
  jointType?: string;
  capacity?: number;
  properties: Record<string, string | number | boolean | null | undefined>;
}
export interface ParsedRoadData {
  layerName: string;
  featureCount: number;
  totalLength: number; // meters
  roadSegments: RoadSegmentItem[];
}
export interface RoadSegmentItem {
  index: number;
  roadName: string;
  coordinates: [number, number][];
  length: number; // meters
  roadType?: string;
  authority?: string;
  properties: Record<string, string | number | boolean | null | undefined>;
}
export interface ParsedPointAssetData {
  layerName: string;
  featureCount: number;
  assetType: GISLayerType;
  assets: PointAssetItem[];
}
export interface PointAssetItem {
  index: number;
  latitude: number;
  longitude: number;
  code?: string;
  type?: string;
  capacity?: number;
  properties: Record<string, string | number | boolean | null | undefined>;
}