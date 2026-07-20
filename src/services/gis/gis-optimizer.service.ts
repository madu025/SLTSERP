import { prisma } from '@/lib/prisma';
import RBush from 'rbush';

/**
 * pure JS Haversine formula implementation for backend distance calculations (in meters)
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
}

interface Coordinate {
    lat: number;
    lng: number;
}

interface RBushLineItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    type: 'LineString';
    projectCode: string;
    projectName: string;
    coords: [number, number][];
}

interface RBushPointItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    type: 'Point';
    projectCode: string;
    projectName: string;
    assetType: string;
    coord: [number, number];
}

type RBushGISItem = RBushLineItem | RBushPointItem;

export class GISRouteOptimizerService {
    /**
     * Optimizes a planned route by detecting overlaps with all active/completed routes in the database.
     * Marks overlapping portions as 'EXISTING_INFRASTRUCTURE' (skipping survey) and detects remaining segments.
     */
    static async optimizeRoute(projectId: string, routeId: string, toleranceMeters: number = 10) {
        // 1. Fetch current planned route
        const currentRoute = await prisma.gISRoute.findUnique({
            where: { id: routeId },
            select: {
                geojsonData: true,
                project: {
                    select: { name: true, projectCode: true }
                }
            }
        });

        if (!currentRoute || !currentRoute.geojsonData) {
            throw new Error("PLANNED_ROUTE_NOT_FOUND");
        }

        // 2. Fetch all completed/approved routes from other projects (As-Built maps)
        // Selectively fetch to avoid database egress issues (don't load heavy metadata column)
        const completedRoutesRaw = await prisma.gISRoute.findMany({
            where: {
                projectId: { not: projectId },
                status: "APPROVED",
                isActive: true
            },
            select: {
                geojsonData: true,
                project: {
                    select: { name: true, projectCode: true }
                }
            }
        });

        // 3. Build spatial index using RBush
        const spatialIndex = new RBush<RBushGISItem>();
        const indexItems: RBushGISItem[] = [];

        for (const route of completedRoutesRaw) {
            if (!route.geojsonData) continue;
            const projectCode = route.project?.projectCode || 'Unknown';
            const projectName = route.project?.name || 'Completed Project';

            const features = (route.geojsonData as any).features || [];
            for (const feature of features) {
                const geom = feature.geometry;
                if (!geom) continue;

                if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
                    const coords = geom.coordinates;
                    for (let i = 0; i < coords.length - 1; i++) {
                        const p1 = coords[i];
                        const p2 = coords[i + 1];
                        indexItems.push({
                            minX: Math.min(p1[0], p2[0]),
                            minY: Math.min(p1[1], p2[1]),
                            maxX: Math.max(p1[0], p2[0]),
                            maxY: Math.max(p1[1], p2[1]),
                            type: 'LineString',
                            projectCode,
                            projectName,
                            coords: [p1, p2]
                        });
                    }
                } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                    const coord = geom.coordinates;
                    const layer = (feature.properties?.layer || feature.properties?.Layer || '').toUpperCase();
                    const assetType = layer.includes('POLE') ? 'Pole' : layer.includes('CHAMBER') ? 'Chamber' : 'Joint';
                    indexItems.push({
                        minX: coord[0],
                        minY: coord[1],
                        maxX: coord[0],
                        maxY: coord[1],
                        type: 'Point',
                        projectCode,
                        projectName,
                        assetType,
                        coord: [coord[0], coord[1]]
                    });
                }
            }
        }

        if (indexItems.length > 0) {
            spatialIndex.load(indexItems);
        }

        const plannedFeatures = (currentRoute.geojsonData as any).features || [];
        const optimizedFeatures: any[] = [];
        let totalPlannedLength = 0;
        let optimizedSavedLength = 0;
        let newSurveyLength = 0;

        // Iterate through features in the planned route
        for (const feature of plannedFeatures) {
            const geom = feature.geometry;
            if (!geom) continue;

            const props = feature.properties || {};

            // If it's a LineString (Cable Segment)
            if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
                const coordinates: Coordinate[] = geom.coordinates.map((c: any) => ({ lng: c[0], lat: c[1] }));
                
                // Calculate segment lengths and check overlaps
                let segmentLength = 0;
                let overlapLength = 0;
                const optimizedCoords: any[] = [];

                for (let i = 0; i < coordinates.length - 1; i++) {
                    const start = coordinates[i];
                    const end = coordinates[i + 1];
                    const dist = calculateHaversineDistance(start.lat, start.lng, end.lat, end.lng);
                    segmentLength += dist;

                    // Check if this sub-segment is close to any completed route in the R-Tree
                    const isOverlapping = this.checkSegmentOverlap(start, end, spatialIndex, toleranceMeters);

                    if (isOverlapping.overlapping) {
                        overlapLength += dist;
                        optimizedCoords.push({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
                            },
                            properties: {
                                ...props,
                                status: 'EXISTING_INFRASTRUCTURE',
                                skipSurvey: true,
                                sourceProject: isOverlapping.projectCode,
                                sourceProjectName: isOverlapping.projectName,
                                color: '#10b981', // green for skipped survey
                                label: `Reused Infrastructure (Project: ${isOverlapping.projectCode})`
                            }
                        });
                    } else {
                        optimizedCoords.push({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
                            },
                            properties: {
                                ...props,
                                status: 'NEW_SURVEY_REQUIRED',
                                skipSurvey: false,
                                color: '#3b82f6', // blue for active survey needed
                                label: 'New Survey Required'
                            }
                        });
                    }
                }

                totalPlannedLength += segmentLength;
                optimizedSavedLength += overlapLength;
                newSurveyLength += (segmentLength - overlapLength);
                
                optimizedFeatures.push(...optimizedCoords);
            } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                // If it's a point asset (Pole/Chamber/Closure)
                const pt: Coordinate = { lng: geom.coordinates[0], lat: geom.coordinates[1] };
                const closeAsset = this.findClosestAsset(pt, spatialIndex, toleranceMeters);

                if (closeAsset) {
                    optimizedFeatures.push({
                        ...feature,
                        properties: {
                            ...props,
                            status: 'EXISTING_INFRASTRUCTURE',
                            skipSurvey: true,
                            sourceProject: closeAsset.projectCode,
                            sourceProjectName: closeAsset.projectName,
                            color: '#10b981', // Green indicator
                            label: `Reused Asset: ${closeAsset.assetType}`
                        }
                    });
                } else {
                    optimizedFeatures.push({
                        ...feature,
                        properties: {
                            ...props,
                            status: 'NEW_SURVEY_REQUIRED',
                            skipSurvey: false,
                            label: 'New Asset Survey Required'
                        }
                    });
                }
            } else {
                // Pass-through other geometries
                optimizedFeatures.push(feature);
            }
        }

        const optimizationSummary = {
            totalPlannedLengthMeters: Math.round(totalPlannedLength),
            reusedInfraLengthMeters: Math.round(optimizedSavedLength),
            newSurveyLengthMeters: Math.round(newSurveyLength),
            percentReduction: totalPlannedLength > 0 ? Math.round((optimizedSavedLength / totalPlannedLength) * 100) : 0,
            optimizedGeojsonData: {
                type: 'FeatureCollection',
                features: optimizedFeatures
            }
        };

        return optimizationSummary;
    }

    /**
     * Checks if a planned cable segment overlaps with any completed OSP routes using RBush spatial index
     */
    private static checkSegmentOverlap(
        start: Coordinate,
        end: Coordinate,
        spatialIndex: RBush<RBushGISItem>,
        toleranceMeters: number
    ): { overlapping: boolean; projectCode?: string; projectName?: string } {
        // Midpoint of the segment
        const mid: Coordinate = {
            lat: (start.lat + end.lat) / 2,
            lng: (start.lng + end.lng) / 2
        };

        const latBuf = toleranceMeters / 111320;
        const lonBuf = toleranceMeters / (111320 * Math.cos(mid.lat * Math.PI / 180));

        const searchBox = {
            minX: mid.lng - lonBuf,
            minY: mid.lat - latBuf,
            maxX: mid.lng + lonBuf,
            maxY: mid.lat + latBuf
        };

        const nearby = spatialIndex.search(searchBox);

        for (const item of nearby) {
            if (item.type === 'LineString') {
                // Check distance from our segment's midpoint to the completed line segment's vertices
                for (const coord of item.coords) {
                    const dist = calculateHaversineDistance(mid.lat, mid.lng, coord[1], coord[0]);
                    if (dist <= toleranceMeters) {
                        return {
                            overlapping: true,
                            projectCode: item.projectCode,
                            projectName: item.projectName
                        };
                    }
                }
            }
        }

        return { overlapping: false };
    }

    /**
     * Checks if a point asset is already close to an existing surveyed asset using RBush spatial index
     */
    private static findClosestAsset(
        pt: Coordinate,
        spatialIndex: RBush<RBushGISItem>,
        toleranceMeters: number
    ) {
        const latBuf = toleranceMeters / 111320;
        const lonBuf = toleranceMeters / (111320 * Math.cos(pt.lat * Math.PI / 180));

        const searchBox = {
            minX: pt.lng - lonBuf,
            minY: pt.lat - latBuf,
            maxX: pt.lng + lonBuf,
            maxY: pt.lat + latBuf
        };

        const nearby = spatialIndex.search(searchBox);

        for (const item of nearby) {
            if (item.type === 'Point') {
                const dist = calculateHaversineDistance(pt.lat, pt.lng, item.coord[1], item.coord[0]);
                if (dist <= toleranceMeters) {
                    return {
                        projectName: item.projectName,
                        projectCode: item.projectCode,
                        assetType: item.assetType
                    };
                }
            }
        }
        return null;
    }
}
