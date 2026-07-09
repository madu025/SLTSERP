'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { Stroke, Style, Circle as CircleStyle, Fill } from 'ol/style';
import Draw from 'ol/interaction/Draw';
import { MEASURE_STYLE, MEASURE_SEGMENT_STYLE } from '../utils/mapStyles';

interface MeasurePoint {
  lonLat: [number, number]; // [lon, lat] in EPSG:4326
  pixel: [number, number];
}

interface UseGISMeasurementProps {
  mapReady: boolean;
  mapRef: React.MutableRefObject<Map | null>;
  measureActive: boolean;
  setMeasureActive: React.Dispatch<React.SetStateAction<boolean>>;
  setAutoPlanActive: React.Dispatch<React.SetStateAction<boolean>>;
  autoPlanDrawRef: React.MutableRefObject<Draw | null>;
}

export function useGISMeasurement({
  mapReady,
  mapRef,
  measureActive,
  setMeasureActive,
  setAutoPlanActive,
  autoPlanDrawRef
}: UseGISMeasurementProps) {
  const measurePointsRef = useRef<MeasurePoint[]>([]);
  const measureSourceRef = useRef<VectorSource | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const measureTooltipRef = useRef<Overlay | null>(null);
  const measureOverlayRef = useRef<HTMLDivElement | null>(null);

  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [lastSegmentDistance, setLastSegmentDistance] = useState<number | null>(null);
  const [, setMeasurePointsCount] = useState<number>(0);

  // Clear measurement drawing and reset stats
  const clearMeasure = useCallback(() => {
    measurePointsRef.current = [];
    setTotalDistance(null);
    setLastSegmentDistance(null);
    setMeasurePointsCount(0);
    if (measureSourceRef.current) {
      measureSourceRef.current.clear();
    }
    if (measureOverlayRef.current) {
      measureOverlayRef.current.style.display = 'none';
    }
  }, []);

  const toggleMeasure = useCallback(() => {
    setMeasureActive((prev) => {
      if (prev) {
        clearMeasure();
      } else {
        setAutoPlanActive(false);
        const map = mapRef.current;
        if (map && autoPlanDrawRef.current) {
          map.removeInteraction(autoPlanDrawRef.current);
          autoPlanDrawRef.current = null;
        }
      }
      return !prev;
    });
  }, [clearMeasure, setMeasureActive, setAutoPlanActive, mapRef, autoPlanDrawRef]);

  // Map click interaction setup
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    const handleMeasureClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => {
      if (!measureActive) return;
      const lonLat = toLonLat(evt.coordinate) as [number, number];
      const points = measurePointsRef.current;
      const source = measureSourceRef.current;
      if (!source) return;

      points.push({ lonLat, pixel: evt.pixel as [number, number] });
      setMeasurePointsCount(points.length);

      if (points.length === 1) {
        const pt = new Point(evt.coordinate);
        const f = new Feature({ geometry: pt });
        f.setStyle(MEASURE_STYLE);
        source.addFeature(f);

        if (measureOverlayRef.current && measureTooltipRef.current) {
          measureOverlayRef.current.innerHTML = '📏 Click next point to measure';
          measureOverlayRef.current.style.display = '';
          measureTooltipRef.current.setPosition(evt.coordinate);
        }
      } else if (points.length >= 2) {
        const prev = points[points.length - 2];
        const prevCoord = fromLonLat(prev.lonLat);
        const currCoord = evt.coordinate;
        const lineStr = new LineString([prevCoord, currCoord]);
        const segFeature = new Feature({ geometry: lineStr });
        segFeature.setStyle(MEASURE_SEGMENT_STYLE);
        source.addFeature(segFeature);

        const segmentMeters = getDistance(prev.lonLat, lonLat);
        setLastSegmentDistance(segmentMeters);

        let total = 0;
        for (let i = 1; i < points.length; i++) {
          total += getDistance(points[i - 1].lonLat, points[i].lonLat);
        }
        setTotalDistance(total);

        const pt = new Point(currCoord);
        const f = new Feature({ geometry: pt });
        f.setStyle(MEASURE_STYLE);
        source.addFeature(f);

        if (measureOverlayRef.current && measureTooltipRef.current) {
          measureOverlayRef.current.innerHTML = `📏 Seg: <b>${segmentMeters.toFixed(2)} m</b><br>📐 Total: <b>${total.toFixed(2)} m</b><br><span style="font-size:9px;opacity:0.7">Click to continue | Double-click to finish</span>`;
          measureOverlayRef.current.style.display = '';
          measureTooltipRef.current.setPosition(currCoord);
        }
      }
    };

    const handleMeasureDblClick = () => {
      if (!measureActive) return;
      const points = measurePointsRef.current;
      if (points.length < 2) return;

      setMeasureActive(false);
      const source = measureSourceRef.current;
      if (source) {
        source.clear();

        const coords = points.map(p => fromLonLat(p.lonLat));
        const finalLine = new LineString(coords);
        const finalFeature = new Feature({ geometry: finalLine });
        finalFeature.setStyle(new Style({
          stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: [10, 5] }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#f59e0b' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }));
        source.addFeature(finalFeature);

        if (points.length > 0) {
          const startPt = new Point(fromLonLat(points[0].lonLat));
          const startF = new Feature({ geometry: startPt });
          startF.setStyle(MEASURE_STYLE);
          source.addFeature(startF);

          const endPt = new Point(fromLonLat(points[points.length - 1].lonLat));
          const endF = new Feature({ geometry: endPt });
          endF.setStyle(new Style({
            image: new CircleStyle({
              radius: 7,
              fill: new Fill({ color: '#ef4444' }),
              stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
          }));
          source.addFeature(endF);
        }
      }

      if (measureOverlayRef.current && measureTooltipRef.current && points.length > 0) {
        const lastCoord = fromLonLat(points[points.length - 1].lonLat);
        let total = 0;
        for (let i = 1; i < points.length; i++) {
          total += getDistance(points[i - 1].lonLat, points[i].lonLat);
        }
        measureOverlayRef.current.innerHTML = `📐 Total: <b>${total.toFixed(2)} m</b> (${points.length} points)`;
        measureOverlayRef.current.style.display = '';
        measureOverlayRef.current.style.background = 'rgba(15, 23, 42, 0.95)';
        measureOverlayRef.current.style.border = '2px solid #ef4444';
        measureTooltipRef.current.setPosition(lastCoord);
      }
    };

    map.on('click', handleMeasureClick);
    map.on('dblclick', handleMeasureDblClick);
    return () => {
      map.un('click', handleMeasureClick);
      map.un('dblclick', handleMeasureDblClick);
    };
  }, [mapReady, measureActive, setMeasureActive, mapRef]);

  // Hook up vector source / overlay refs when map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const mSource = new VectorSource();
    measureSourceRef.current = mSource;
    const mLayer = new VectorLayer({ source: mSource, style: MEASURE_STYLE, zIndex: 1000 });
    measureLayerRef.current = mLayer;
    map.addLayer(mLayer);

    const tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = `
      background: rgba(15, 23, 42, 0.92); color: #fbbf24; font-family: system-ui, sans-serif;
      font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px;
      border: 1.5px solid #f59e0b; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      white-space: nowrap; pointer-events: none; display: none;
    `;
    measureOverlayRef.current = tooltipEl;
    const mTooltip = new Overlay({ element: tooltipEl, offset: [0, -20], positioning: 'bottom-center' });
    measureTooltipRef.current = mTooltip;
    map.addOverlay(mTooltip);

    return () => {
      map.removeLayer(mLayer);
      map.removeOverlay(mTooltip);
    };
  }, [mapReady, mapRef]);

  return {
    totalDistance,
    lastSegmentDistance,
    clearMeasure,
    toggleMeasure
  };
}
