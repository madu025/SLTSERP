// ============================================================================
// AUTO BOQ ENGINE - Automatic Bill of Quantities Generation
// ============================================================================
// Generates BOQ items from parsed GIS data with telecom-specific formulas
// ============================================================================

import {
  BOQSummary,
  BOQItem,
  BOQ_UNIT_RATES,
  ParsedCableData,
  ParsedPoleData,
  ParsedFDPData,
  ParsedFiberJointData,
  ParsedRoadData,
  ParsedPointAssetData,
  GISLayerType,
} from '@/types/gis';

/**
 * Inventory stock entry used to categorize BOQ items as NEW vs EXISTING.
 * Maps a material category to its available quantity and inventory metadata.
 */
export interface InventoryStockEntry {
  category: string;          // e.g., 'CABLE', 'POLE', 'FDP', 'FIBER_JOINT'
  availableQty: number;      // available quantity in inventory
  itemCode?: string;         // inventory item code
  materialId?: string;       // inventory item record id
  unit?: string;             // unit of measure
}

/**
 * Auto BOQ Engine
 * Calculates quantities and costs from GIS layer data
 */
export class BOQEngine {
  /**
    * Generate complete BOQ from all parsed GIS layers.
    *
    * @param layers Parsed GIS layer data keyed by layer type
    * @param region Optional region name for rate adjustments
    * @param regionMultiplier Multiplier applied to base unit rates
    * @param inventoryStock Optional inventory stock entries used to categorize
    *                       items as EXISTING (available in inventory) or NEW
    *                       (to procure). When provided, the engine will attempt
    *                       to match each material category against available
    *                       stock and split quantities accordingly.
    */
  generateBOQ(
    layers: Map<GISLayerType, any>,
    region?: string,
    regionMultiplier: number = 1.0,
    inventoryStock?: InventoryStockEntry[]
  ): BOQSummary {
    const items: BOQItem[] = [];
    let totalEstimatedCost = 0;

    // Build a quick lookup of available stock by category (uppercase)
    const stockByCategory = new Map<string, InventoryStockEntry>();
    if (inventoryStock && inventoryStock.length > 0) {
      for (const entry of inventoryStock) {
        stockByCategory.set(entry.category.toUpperCase(), entry);
      }
    }

    const cableData = layers.get('CABLE') as ParsedCableData | undefined;
    const poleData = layers.get('POLE') as ParsedPoleData | undefined;
    const fdpData = layers.get('FDP') as ParsedFDPData | undefined;
    const jointData = layers.get('FIBER_JOINT') as ParsedFiberJointData | undefined;
    const roadData = layers.get('ROAD_EOP') as ParsedRoadData | undefined;
    // New layer types (all parsed as ParsedPointAssetData)
    const ductData = layers.get('DUCT') as ParsedPointAssetData | undefined;
    const handholeData = layers.get('HANDHOLE') as ParsedPointAssetData | undefined;
    const manholeData = layers.get('MANHOLE') as ParsedPointAssetData | undefined;
    const odfData = layers.get('ODF') as ParsedPointAssetData | undefined;
    const riserData = layers.get('RISER') as ParsedPointAssetData | undefined;
    const ftcData = layers.get('FTC') as ParsedPointAssetData | undefined;
    const testPointData = layers.get('TEST_POINT') as ParsedPointAssetData | undefined;

    // ======================================================================
    // 1. Fiber Cable
    // Unit: Meters
    // Formula: totalCableLength * ratePerMeter
    // ======================================================================
    if (cableData && cableData.totalLength > 0) {
      const cableLength = cableData.totalLength;
      const cableRate = BOQ_UNIT_RATES['FIBER_CABLE_PER_METER'] * regionMultiplier;
      const cableCost = cableLength * cableRate;

      items.push({
        category: 'CABLE',
        description: `Fiber Optic Cable (${cableData.cableType || '24F SM'}) - Installation & Splicing`,
        unit: 'Meter',
        quantity: Math.round(cableLength * 100) / 100,
        unitRate: Math.round(cableRate * 100) / 100,
        amount: Math.round(cableCost * 100) / 100,
      });
      totalEstimatedCost += cableCost;
    }

    // ======================================================================
    // 2. Poles
    // Unit: Each
    // Formula: poleCount * ratePerPole
    // ======================================================================
    if (poleData && poleData.featureCount > 0) {
      const poleCount = poleData.featureCount;
      const poleRate = BOQ_UNIT_RATES['POLE'] * regionMultiplier;
      const poleCost = poleCount * poleRate;

      items.push({
        category: 'POLE',
        description: `Telecom Poles (${poleCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: poleCount,
        unitRate: Math.round(poleRate * 100) / 100,
        amount: Math.round(poleCost * 100) / 100,
      });
      totalEstimatedCost += poleCost;
    }

    // ======================================================================
    // 3. FDPs (Fiber Distribution Points)
    // Unit: Each
    // Formula: fdpCount * ratePerFDP
    // ======================================================================
    if (fdpData && fdpData.featureCount > 0) {
      const fdpCount = fdpData.featureCount;
      const fdpRate = BOQ_UNIT_RATES['FDP'] * regionMultiplier;
      const fdpCost = fdpCount * fdpRate;

      items.push({
        category: 'FDP',
        description: `Fiber Distribution Points (${fdpCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: fdpCount,
        unitRate: Math.round(fdpRate * 100) / 100,
        amount: Math.round(fdpCost * 100) / 100,
      });
      totalEstimatedCost += fdpCost;
    }

    // ======================================================================
    // 4. Joint Closures
    // Unit: Each
    // Formula: jointCount * ratePerJoint
    // ======================================================================
    if (jointData && jointData.featureCount > 0) {
      const jointCount = jointData.featureCount;
      const jointRate = BOQ_UNIT_RATES['FIBER_JOINT'] * regionMultiplier;
      const jointCost = jointCount * jointRate;

      items.push({
        category: 'FIBER_JOINT',
        description: `Fiber Joint Closures (${jointCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: jointCount,
        unitRate: Math.round(jointRate * 100) / 100,
        amount: Math.round(jointCost * 100) / 100,
      });
      totalEstimatedCost += jointCost;
    }

    // ======================================================================
    // 4b. Ducts
    // ======================================================================
    if (ductData && ductData.featureCount > 0) {
      const ductCount = ductData.featureCount;
      const ductRate = (BOQ_UNIT_RATES['DUCT'] || 1500) * regionMultiplier;
      const ductCost = ductCount * ductRate;
      items.push({
        category: 'DUCT',
        description: `Ducts (${ductCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: ductCount,
        unitRate: Math.round(ductRate * 100) / 100,
        amount: Math.round(ductCost * 100) / 100,
      });
      totalEstimatedCost += ductCost;
    }

    // ======================================================================
    // 4c. Handholes
    // ======================================================================
    if (handholeData && handholeData.featureCount > 0) {
      const hhCount = handholeData.featureCount;
      const hhRate = (BOQ_UNIT_RATES['HANDHOLE'] || 25000) * regionMultiplier;
      const hhCost = hhCount * hhRate;
      items.push({
        category: 'HANDHOLE',
        description: `Handholes (${hhCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: hhCount,
        unitRate: Math.round(hhRate * 100) / 100,
        amount: Math.round(hhCost * 100) / 100,
      });
      totalEstimatedCost += hhCost;
    }

    // ======================================================================
    // 4d. Manholes
    // ======================================================================
    if (manholeData && manholeData.featureCount > 0) {
      const mhCount = manholeData.featureCount;
      const mhRate = (BOQ_UNIT_RATES['MANHOLE'] || 85000) * regionMultiplier;
      const mhCost = mhCount * mhRate;
      items.push({
        category: 'MANHOLE',
        description: `Manholes (${mhCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: mhCount,
        unitRate: Math.round(mhRate * 100) / 100,
        amount: Math.round(mhCost * 100) / 100,
      });
      totalEstimatedCost += mhCost;
    }

    // ======================================================================
    // 4e. ODF (Optical Distribution Frame)
    // ======================================================================
    if (odfData && odfData.featureCount > 0) {
      const odfCount = odfData.featureCount;
      const odfRate = (BOQ_UNIT_RATES['ODF'] || 120000) * regionMultiplier;
      const odfCost = odfCount * odfRate;
      items.push({
        category: 'ODF',
        description: `Optical Distribution Frames (${odfCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: odfCount,
        unitRate: Math.round(odfRate * 100) / 100,
        amount: Math.round(odfCost * 100) / 100,
      });
      totalEstimatedCost += odfCost;
    }

    // ======================================================================
    // 4f. Risers
    // ======================================================================
    if (riserData && riserData.featureCount > 0) {
      const riserCount = riserData.featureCount;
      const riserRate = (BOQ_UNIT_RATES['RISER'] || 18000) * regionMultiplier;
      const riserCost = riserCount * riserRate;
      items.push({
        category: 'RISER',
        description: `Risers (${riserCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: riserCount,
        unitRate: Math.round(riserRate * 100) / 100,
        amount: Math.round(riserCost * 100) / 100,
      });
      totalEstimatedCost += riserCost;
    }

    // ======================================================================
    // 4g. FTC (Fiber Termination Cabinet)
    // ======================================================================
    if (ftcData && ftcData.featureCount > 0) {
      const ftcCount = ftcData.featureCount;
      const ftcRate = (BOQ_UNIT_RATES['FTC'] || 95000) * regionMultiplier;
      const ftcCost = ftcCount * ftcRate;
      items.push({
        category: 'FTC',
        description: `Fiber Termination Cabinets (${ftcCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: ftcCount,
        unitRate: Math.round(ftcRate * 100) / 100,
        amount: Math.round(ftcCost * 100) / 100,
      });
      totalEstimatedCost += ftcCost;
    }

    // ======================================================================
    // 4h. Test Points
    // ======================================================================
    if (testPointData && testPointData.featureCount > 0) {
      const tpCount = testPointData.featureCount;
      const tpRate = (BOQ_UNIT_RATES['TEST_POINT'] || 5000) * regionMultiplier;
      const tpCost = tpCount * tpRate;
      items.push({
        category: 'TEST_POINT',
        description: `Test Points (${tpCount} units) - Supply & Installation`,
        unit: 'Each',
        quantity: tpCount,
        unitRate: Math.round(tpRate * 100) / 100,
        amount: Math.round(tpCost * 100) / 100,
      });
      totalEstimatedCost += tpCost;
    }

    // ======================================================================
    // 5. Warning Tape
    // Unit: Meters
    // Formula: (cableLength * 1.1) * ratePerMeter (10% extra for overlaps)
    // ======================================================================
    if (cableData && cableData.totalLength > 0) {
      const tapeLength = cableData.totalLength * 1.1; // 10% overlap allowance
      const tapeRate = BOQ_UNIT_RATES['WARNING_TAPE_PER_METER'] * regionMultiplier;
      const tapeCost = tapeLength * tapeRate;

      items.push({
        category: 'ACCESSORIES',
        description: 'Warning Tape for Buried Cable - Supply & Installation',
        unit: 'Meter',
        quantity: Math.round(tapeLength * 100) / 100,
        unitRate: Math.round(tapeRate * 100) / 100,
        amount: Math.round(tapeCost * 100) / 100,
      });
      totalEstimatedCost += tapeCost;
    }

    // ======================================================================
    // 6. Road Crossings
    // Unit: Each
    // Extracted from road layer intersections with cable route
    // ======================================================================
    const roadCrossings = this.calculateRoadCrossings(roadData, cableData);
    if (roadCrossings > 0) {
      const crossingRate = BOQ_UNIT_RATES['ROAD_CROSSING'] * regionMultiplier;
      const crossingCost = roadCrossings * crossingRate;

      items.push({
        category: 'ROAD_CROSSING',
        description: `Road Crossings (${roadCrossings} crossings) - HDD/Trenching`,
        unit: 'Each',
        quantity: roadCrossings,
        unitRate: Math.round(crossingRate * 100) / 100,
        amount: Math.round(crossingCost * 100) / 100,
      });
      totalEstimatedCost += crossingCost;
    }

    // ======================================================================
    // 7. Accessories (8% of total material cost)
    // ======================================================================
    const materialCost = totalEstimatedCost;
    const accessoriesCost = materialCost * BOQ_UNIT_RATES['ACCESSORIES_PERCENTAGE'];

    items.push({
      category: 'ACCESSORIES',
      description: 'Cable Accessories (Clamps, Brackets, Splices, Connectors) - 8% of material',
      unit: 'Lot',
      quantity: 1,
      unitRate: Math.round(accessoriesCost * 100) / 100,
      amount: Math.round(accessoriesCost * 100) / 100,
    });
    totalEstimatedCost += accessoriesCost;

    // ======================================================================
    // 8. Installation Labor (if no poles/FDPs - cable only projects)
    // ======================================================================
    if (cableData && cableData.totalLength > 0 && !poleData && !fdpData) {
      const laborRate = 500 * regionMultiplier; // LKR per meter
      const laborCost = cableData.totalLength * laborRate;

      items.push({
        category: 'LABOR',
        description: 'Cable Installation Labor (Aerial/Buried)',
        unit: 'Meter',
        quantity: Math.round(cableData.totalLength * 100) / 100,
        unitRate: Math.round(laborRate * 100) / 100,
        amount: Math.round(laborCost * 100) / 100,
      });
      totalEstimatedCost += laborCost;
    }

    // ======================================================================
    // POST-PROCESSING: Categorize items as NEW (to procure) or EXISTING
    // (available in inventory) based on the provided inventory stock.
    // Material categories (CABLE, POLE, FDP, FIBER_JOINT) are split into
    // an EXISTING line (up to available stock) and a NEW line (remainder).
    // Non-material items (LABOR, ROAD_CROSSING) default to 'NEW'.
    // ======================================================================
    const categorizedItems: BOQItem[] = [];

    for (const item of items) {
      const stockEntry = stockByCategory.get(item.category.toUpperCase());

      if (
        stockEntry &&
        stockEntry.availableQty > 0 &&
        item.quantity > 0 &&
        item.category !== 'LABOR' &&
        item.category !== 'ROAD_CROSSING'
      ) {
        const existingQty = Math.min(stockEntry.availableQty, item.quantity);
        const newQty = item.quantity - existingQty;
        const perUnitRate = item.unitRate;

        if (existingQty > 0) {
          categorizedItems.push({
            ...item,
            quantity: Math.round(existingQty * 100) / 100,
            amount: Math.round(existingQty * perUnitRate * 100) / 100,
            source: 'EXISTING',
            itemCode: stockEntry.itemCode,
            materialId: stockEntry.materialId,
          });
        }

        if (newQty > 0) {
          categorizedItems.push({
            ...item,
            quantity: Math.round(newQty * 100) / 100,
            amount: Math.round(newQty * perUnitRate * 100) / 100,
            source: 'NEW',
          });
        }
      } else {
        // No matching inventory stock — mark as NEW (default procurement)
        categorizedItems.push({ ...item, source: 'NEW' });
      }
    }

    return {
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      items: categorizedItems,
    };
  }

  /**
   * Count road crossings by analyzing intersections between cable and road layers
   */
  private calculateRoadCrossings(
    roadData?: ParsedRoadData,
    cableData?: ParsedCableData
  ): number {
    if (!roadData || !cableData) return 0;

    // Simple heuristic: each road segment near the cable route is a crossing
    // In production, this would use actual line intersection algorithms
    let crossingCount = 0;

    for (const road of roadData.roadSegments) {
      for (const segment of cableData.segments) {
        if (this.linesIntersectApprox(road.coordinates, segment.coordinates)) {
          crossingCount++;
        }
      }
    }

    return crossingCount;
  }

  /**
   * Approximate line intersection detection using bounding boxes
   */
  private linesIntersectApprox(
    line1: [number, number][],
    line2: [number, number][]
  ): boolean {
    if (line1.length < 2 || line2.length < 2) return false;

    // Get bounding boxes
    const bb1 = this.getBoundingBox(line1);
    const bb2 = this.getBoundingBox(line2);

    // Check if bounding boxes overlap
    const overlapLng =
      bb1.maxLng >= bb2.minLng && bb2.maxLng >= bb1.minLng;
    const overlapLat =
      bb1.maxLat >= bb2.minLat && bb2.maxLat >= bb1.minLat;

    return overlapLng && overlapLat;
  }

  /**
   * Get bounding box for a set of coordinates
   */
  private getBoundingBox(coords: [number, number][]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLng = Infinity,
      maxLng = -Infinity;

    for (const [lng, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    return { minLat, maxLat, minLng, maxLng };
  }
}

// Singleton instance
export const boqEngine = new BOQEngine();
