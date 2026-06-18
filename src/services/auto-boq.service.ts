import { prisma } from '@/lib/prisma';

interface CableSection {
  startPoint: { latitude: number; longitude: number; attributes: Record<string, unknown> };
  endPoint: { latitude: number; longitude: number; attributes: Record<string, unknown> };
  routePolylineLength?: number; // Actual QGIS route polyline length if available
  joints?: unknown[];
}

interface BOQConfig {
  startReserve: number;     // meters (default 10)
  endReserve: number;       // meters (default 10)
  jointReserve: number;     // meters per joint (default 5)
  maintenanceLoop: number;  // meters if route > threshold (default 10)
  longRouteThreshold: number; // meters (default 500)
  routeFactorPct: number;   // % terrain adjustment (default 0)
}

interface BOQItem {
  itemCategory: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  sourceType: string;
  sourceReference: string;
}

const DEFAULT_CONFIG: BOQConfig = {
  startReserve: 10,
  endReserve: 10,
  jointReserve: 5,
  maintenanceLoop: 10,
  longRouteThreshold: 500,
  routeFactorPct: 0,
};

export class AutoBOQService {
  private config: BOQConfig;
  private rates: Record<string, number>;

  constructor(config?: Partial<BOQConfig>, rates?: Record<string, number>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rates = rates || {};
  }

  /**
   * Main entry: generate full BOQ from approved survey points
   * @param projectId - SLTSERP project ID
   * @param cableConfigOverride - Optional overrides for cable slack/loop formula
   */
  static async generateBOQ(
    projectId: string,
    cableConfigOverride?: Partial<BOQConfig>
  ): Promise<{ boq: BOQItem[]; summary: Record<string, number>; cableConfig: BOQConfig }> {
    // Load BOQ rate configs for this project
    const rateConfigs = await prisma.bOQRateConfig.findMany({
      where: { OR: [{ projectId }, { projectId: null }], isActive: true },
    });

    const rates: Record<string, number> = {};
    for (const rc of rateConfigs) {
      rates[rc.itemCode] = rc.unitRate;
    }

    // Load cable config from project GIS mapping or use env defaults
    let config: Partial<BOQConfig> = {};
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { gisMapping: true },
    });

    // Merge: env defaults → project-level config → API override
    const envConfig: Partial<BOQConfig> = {};
    if (process.env.BOQ_START_RESERVE) envConfig.startReserve = Number(process.env.BOQ_START_RESERVE);
    if (process.env.BOQ_END_RESERVE) envConfig.endReserve = Number(process.env.BOQ_END_RESERVE);
    if (process.env.BOQ_JOINT_RESERVE) envConfig.jointReserve = Number(process.env.BOQ_JOINT_RESERVE);
    if (process.env.BOQ_MAINTENANCE_LOOP) envConfig.maintenanceLoop = Number(process.env.BOQ_MAINTENANCE_LOOP);
    if (process.env.BOQ_LONG_ROUTE_THRESHOLD) envConfig.longRouteThreshold = Number(process.env.BOQ_LONG_ROUTE_THRESHOLD);
    if (process.env.BOQ_ROUTE_FACTOR_PCT) envConfig.routeFactorPct = Number(process.env.BOQ_ROUTE_FACTOR_PCT);

    const projectConfig = (project?.gisMapping as Record<string, unknown> | null)?.cableConfig as Partial<BOQConfig> | undefined;

    config = { ...envConfig, ...projectConfig, ...cableConfigOverride };

    const service = new AutoBOQService(config, rates);

    // Load APPROVED survey points only
    const approvedPoints = await prisma.surveyPoint.findMany({
      where: { projectId, verificationStatus: 'APPROVED' },
    });

    const byLayer: Record<string, typeof approvedPoints> = {};
    for (const pt of approvedPoints) {
      if (!byLayer[pt.layerId]) byLayer[pt.layerId] = [];
      byLayer[pt.layerId].push(pt);
    }

    const allItems: BOQItem[] = [];

    // Process each layer
    allItems.push(...service.processExistingPoles(byLayer['survey_existing_pole'] || []));
    allItems.push(...service.processNewPoles(byLayer['survey_new_pole'] || []));
    allItems.push(...service.processJointClosures(byLayer['survey_joint_closure'] || []));
    allItems.push(...service.processEnclosures(byLayer['survey_enclosure'] || []));
    allItems.push(...service.processFDPs(byLayer['survey_fdp'] || []));
    allItems.push(...service.processChambers(byLayer['survey_chamber'] || []));
    allItems.push(...service.processRoadCrossings(byLayer['survey_road_crossing'] || []));
    allItems.push(...service.processObstructions(byLayer['survey_obstruction'] || []));

    // Cable sections: match A-end to B-end
    const cableStartPoints = byLayer['survey_cable_start'] || [];
    const cableEndPoints = byLayer['survey_cable_end'] || [];
    const joints = byLayer['survey_joint_closure'] || [];
    allItems.push(...service.processCableSections(cableStartPoints, cableEndPoints, joints));

    // Summary totals by category
    const summary: Record<string, number> = {};
    for (const item of allItems) {
      summary[item.itemCategory] = (summary[item.itemCategory] || 0) + item.amount;
    }
    summary.TOTAL = Object.values(summary).reduce((a, b) => a + b, 0);

    // Include config used (for transparency)
    return { boq: allItems, summary, cableConfig: service.config };
  }

  /**
   * Telecom Cable Length Formula (most accurate)
   * Uses actual QGIS route polyline length if available, fallback to GPS Haversine
   */
  calculateCableLength(section: CableSection): number {
    const actualRouteLength =
      section.routePolylineLength ??
      this.calculateHaversineDistance(
        section.startPoint.latitude, section.startPoint.longitude,
        section.endPoint.latitude, section.endPoint.longitude
      );

    const jointCount = section.joints?.length ?? 0;
    // Every 500m segment gets 10m maintenance loop (scaling)
    // 500m→1×10=10, 1200m→2×10=20, 2500m→5×10=50
    const maintenanceLoops = Math.floor(actualRouteLength / this.config.longRouteThreshold);

    return (
      actualRouteLength
      + this.config.startReserve
      + this.config.endReserve
      + jointCount * this.config.jointReserve
      + maintenanceLoops * this.config.maintenanceLoop
      + actualRouteLength * (this.config.routeFactorPct / 100)
    );
  }

  /**
   * Haversine GPS straight-line distance (fallback)
   */
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private rate(code: string): number {
    return this.rates[code] ?? 0;
  }

  // ─── Layer Processors ─────────────────────────────────────────────────────

  private processExistingPoles(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    // Existing poles: labor only (no materials)
    return [{
      itemCategory: 'LABOR',
      itemCode: 'LAB-POLE-ATTACH',
      description: `Cable Attachment to Existing Poles (${points.length} poles)`,
      unit: 'POLE',
      quantity: points.length,
      unitRate: this.rate('LAB-POLE-ATTACH'),
      amount: points.length * this.rate('LAB-POLE-ATTACH'),
      sourceType: 'AUTO_CALCULATED',
      sourceReference: 'survey_existing_pole',
    }];
  }

  private processNewPoles(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MATERIAL',
        itemCode: 'MAT-POLE-CONCRETE',
        description: `Concrete Poles (${count} units)`,
        unit: 'POLE',
        quantity: count,
        unitRate: this.rate('MAT-POLE-CONCRETE'),
        amount: count * this.rate('MAT-POLE-CONCRETE'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_new_pole',
      },
      {
        itemCategory: 'LABOR',
        itemCode: 'LAB-POLE-ERECT',
        description: `Pole Erection Labor (${count} poles)`,
        unit: 'POLE',
        quantity: count,
        unitRate: this.rate('LAB-POLE-ERECT'),
        amount: count * this.rate('LAB-POLE-ERECT'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_new_pole',
      },
    ];
  }

  private processJointClosures(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MATERIAL',
        itemCode: 'MAT-CLOSURE-DOME',
        description: `Joint Closure Domes (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('MAT-CLOSURE-DOME'),
        amount: count * this.rate('MAT-CLOSURE-DOME'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_joint_closure',
      },
      {
        itemCategory: 'LABOR',
        itemCode: 'LAB-SPLICING',
        description: `Fiber Splicing Labor (${count} closures)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('LAB-SPLICING'),
        amount: count * this.rate('LAB-SPLICING'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_joint_closure',
      },
    ];
  }

  private processEnclosures(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MATERIAL',
        itemCode: 'MAT-ODF-ENCLOSURE',
        description: `ODF Enclosures (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('MAT-ODF-ENCLOSURE'),
        amount: count * this.rate('MAT-ODF-ENCLOSURE'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_enclosure',
      },
      {
        itemCategory: 'LABOR',
        itemCode: 'LAB-ENCLOSURE-INSTALL',
        description: `Enclosure Installation Labor (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('LAB-ENCLOSURE-INSTALL'),
        amount: count * this.rate('LAB-ENCLOSURE-INSTALL'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_enclosure',
      },
    ];
  }

  private processFDPs(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MATERIAL',
        itemCode: 'MAT-FDP-BOX',
        description: `FDP Distribution Points (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('MAT-FDP-BOX'),
        amount: count * this.rate('MAT-FDP-BOX'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_fdp',
      },
    ];
  }

  private processChambers(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MATERIAL',
        itemCode: 'MAT-CHAMBER',
        description: `Underground Chambers (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('MAT-CHAMBER'),
        amount: count * this.rate('MAT-CHAMBER'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_chamber',
      },
      {
        itemCategory: 'LABOR',
        itemCode: 'LAB-EXCAVATION',
        description: `Chamber Excavation Labor (${count} units)`,
        unit: 'UNIT',
        quantity: count,
        unitRate: this.rate('LAB-EXCAVATION'),
        amount: count * this.rate('LAB-EXCAVATION'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_chamber',
      },
    ];
  }

  private processRoadCrossings(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'LABOR',
        itemCode: 'LAB-ROAD-CROSSING',
        description: `Road Crossing Labor (${count} crossings)`,
        unit: 'CROSSING',
        quantity: count,
        unitRate: this.rate('LAB-ROAD-CROSSING'),
        amount: count * this.rate('LAB-ROAD-CROSSING'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_road_crossing',
      },
    ];
  }

  private processObstructions(points: { attributes: unknown }[]): BOQItem[] {
    if (!points.length) return [];
    const count = points.length;
    return [
      {
        itemCategory: 'MISC',
        itemCode: 'MISC-OBSTRUCTION',
        description: `Obstruction Mitigation (${count} items)`,
        unit: 'ITEM',
        quantity: count,
        unitRate: this.rate('MISC-OBSTRUCTION'),
        amount: count * this.rate('MISC-OBSTRUCTION'),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: 'survey_obstruction',
      },
    ];
  }

  private processCableSections(
    startPoints: { latitude: number; longitude: number; attributes: unknown; id: string }[],
    endPoints: { latitude: number; longitude: number; attributes: unknown; id: string }[],
    joints: unknown[]
  ): BOQItem[] {
    const items: BOQItem[] = [];

    // Pair start and end points by section_number attribute
    for (const start of startPoints) {
      const attrs = (start.attributes as Record<string, unknown>);
      const sectionNum = attrs.section_number as string;
      const fiberCount = (attrs.fiber_count as number) || 12;
      const cableType = (attrs.cable_type as string) || 'SM';
      const installMethod = (attrs.install_method as string) || 'AERIAL';

      const end = endPoints.find((e) => {
        const ea = e.attributes as Record<string, unknown>;
        return ea.section_number === sectionNum;
      });

      if (!end) continue;

      const section: CableSection = {
        startPoint: { latitude: start.latitude, longitude: start.longitude, attributes: start.attributes as Record<string, unknown> },
        endPoint: { latitude: end.latitude, longitude: end.longitude, attributes: end.attributes as Record<string, unknown> },
        joints: joints,
      };

      const cableLength = Math.ceil(this.calculateCableLength(section));
      const itemCode = `CABLE-${cableType}-${fiberCount}F`;
      const laborCode = `LAB-CABLE-${installMethod}`;

      items.push({
        itemCategory: 'CABLE',
        itemCode,
        description: `${cableType} Fiber ${fiberCount}F Cable - Section ${sectionNum} (${cableLength}m incl. slack)`,
        unit: 'METER',
        quantity: cableLength,
        unitRate: this.rate(itemCode),
        amount: cableLength * this.rate(itemCode),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: `section_${sectionNum}`,
      });

      items.push({
        itemCategory: 'LABOR',
        itemCode: laborCode,
        description: `Cable Pulling Labor (${installMethod}) - Section ${sectionNum} (${cableLength}m)`,
        unit: 'METER',
        quantity: cableLength,
        unitRate: this.rate(laborCode),
        amount: cableLength * this.rate(laborCode),
        sourceType: 'AUTO_CALCULATED',
        sourceReference: `section_${sectionNum}`,
      });
    }

    return items;
  }
}
