import { prisma } from '@/lib/prisma';
import { GISAuditService } from './gis-audit.service';
import { updateProgressOnBOQGenerate } from '@/lib/project-progress';
import { BOQEngine } from '@/lib/gis/boq-engine';
import { GISAIService } from '@/services/gis/gis-ai.service';
import { GISLayerType, ParsedCableData, ParsedPoleData, ParsedFiberJointData } from '@/types/gis';


export interface CreateGISRouteDTO {
    name: string;
    description?: string | null;
    routeLength?: string | number | null;
    poleSpacing?: string | number | null;
    sourceFile?: string | null;
    sourceFormat?: string | null;
    geojsonData?: any;
    metadata?: any;
    createdById?: string | null;
}

export class GISRouteService {
    /**
     * List GIS routes for project with count of elements
     */
    static async listProjectRoutes(projectId: string) {
        return await prisma.gISRoute.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: {
                        poles: true,
                        chambers: true,
                        closures: true,
                        cableSegments: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Create a GIS route
     */
    static async createGISRoute(projectId: string, data: CreateGISRouteDTO, userId: string) {
        const {
            name, description, routeLength, poleSpacing, sourceFile,
            sourceFormat, geojsonData, metadata, createdById
        } = data;

        const calculatedPoles = routeLength && poleSpacing
            ? Math.ceil(parseFloat(routeLength.toString()) / parseFloat(poleSpacing.toString()))
            : null;

        const gisRoute = await prisma.gISRoute.create({
            data: {
                projectId,
                name,
                description: description || null,
                routeLength: routeLength ? parseFloat(routeLength.toString()) : null,
                poleSpacing: poleSpacing ? parseFloat(poleSpacing.toString()) : null,
                calculatedPoles,
                sourceFile: sourceFile || null,
                sourceFormat: sourceFormat || null,
                geojsonData: geojsonData || null,
                metadata: metadata || null,
                createdById: createdById || null,
                status: 'DRAFT'
            },
            include: {
                _count: {
                    select: {
                        poles: true,
                        chambers: true,
                        closures: true,
                        cableSegments: true
                    }
                }
            }
        });

        // Write audit log
        const performedById = createdById || userId || 'unknown';
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: gisRoute.id,
            action: 'ROUTE_CREATED',
            performedById,
            routeVersion: gisRoute.version,
            source: 'WEB_PORTAL'
        }).catch((e) => console.error('Audit log failed on route create:', e));

        return gisRoute;
    }

    /**
     * Generate BOQ from GIS route
     */
    static async generateBOQFromRoute(
        projectId: string,
        routeId: string,
        data: { notes?: string | null; createdById?: string | null },
        userId: string
    ) {
        // Fetch GIS route with all related elements
        const gisRoute = await prisma.gISRoute.findFirst({
            where: {
                id: routeId,
                projectId
            },
            include: {
                poles: true,
                chambers: true,
                closures: true,
                cableSegments: true
            }
        });

        if (!gisRoute) {
            throw new Error('GIS_ROUTE_NOT_FOUND');
        }

        const { notes, createdById } = data;

        // Auto-calculate quantities
        const poleCount = gisRoute.poles.length;
        const chamberCount = gisRoute.chambers.length;
        const closureCount = gisRoute.closures.length;
        const cableSegmentCount = gisRoute.cableSegments.length;
        const totalCableLength = gisRoute.cableSegments.reduce((sum, seg) => sum + (seg.length || 0), 0);

        // Load project-level GIS Material Mapping
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { gisMapping: true }
        });

        type MappingEntry = {
            materialId: string;
            itemCode: string;
            name: string;
            unitPrice: number;
        };
        const gisMapping = (project?.gisMapping as Record<string, MappingEntry> | null) || {};

        // Fetch inventory items for unit rates + stock
        const mappedMaterialIds = Object.values(gisMapping)
            .map((m: MappingEntry) => m.materialId)
            .filter(Boolean);

        const inventoryItems = await prisma.inventoryItem.findMany({
            where: mappedMaterialIds.length > 0
                ? { id: { in: mappedMaterialIds } }
                : {
                    OR: [
                        { code: { contains: 'POLE', mode: 'insensitive' } },
                        { code: { contains: 'CBL', mode: 'insensitive' } },
                        { name: { contains: 'Pole', mode: 'insensitive' } },
                        { name: { contains: 'Fiber', mode: 'insensitive' } },
                        { name: { contains: 'Cable', mode: 'insensitive' } },
                        { name: { contains: 'Chamber', mode: 'insensitive' } },
                        { name: { contains: 'Closure', mode: 'insensitive' } },
                        { name: { contains: 'Splice', mode: 'insensitive' } },
                        { name: { contains: 'Manhole', mode: 'insensitive' } }
                    ]
                },
            include: {
                stocks: true
            },
            take: 50
        });

        const inventoryById = new Map(inventoryItems.map(i => [i.id, i]));

        // Helper to get mapped inventory item for a category
        const getMappedItem = (category: string) => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            if (mapping?.materialId) {
                const item = inventoryById.get(mapping.materialId);
                if (item) return item;
            }
            // Fallback: keyword search
            const keywords = category === 'POLE' ? ['pole', 'wooden', 'concrete']
                : category === 'CHAMBER' ? ['chamber', 'manhole']
                : category === 'CLOSURE' ? ['closure', 'splice']
                : category === 'CABLE' ? ['fiber', 'cable']
                : [];
            return inventoryItems.find((item) =>
                keywords.some((kw) =>
                    item.name?.toLowerCase().includes(kw.toLowerCase()) ||
                    item.code?.toLowerCase().includes(kw.toLowerCase())
                )
            );
        };

        // Helper to get unit rate from mapped item or fallback
        const getRate = (category: string): number => {
            const item = getMappedItem(category);
            return item?.unitPrice ? Number(item.unitPrice) : 0;
        };

        // Build available stock map by BOQ category
        const stockByCategory = new Map<string, { availableQty: number; itemCode: string; materialId: string }>();
        for (const category of ['POLE', 'CHAMBER', 'CLOSURE', 'CABLE']) {
            const inv = getMappedItem(category);
            if (inv) {
                const qty = inv.stocks.reduce((s, st) => s + (st.quantity ? Number(st.quantity) : 0), 0);
                stockByCategory.set(category, { availableQty: qty, itemCode: inv.code, materialId: inv.id });
            }
        }

        // Build GISGeneratedBOQ items
        const gisItems: Array<{
            itemCategory: string;
            itemCode: string;
            description: string;
            unit: string;
            quantity: number;
            unitRate: number;
            amount: number;
            sourceType: string;
            sourceReference: string;
        }> = [];

        const getDescription = (category: string, fallback: string): string => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            return mapping?.name || fallback;
        };

        const getItemCode = (category: string, fallback: string): string => {
            const mapping = gisMapping[category] as MappingEntry | undefined;
            return mapping?.itemCode || fallback;
        };

        const getUnit = (category: string, fallback: string): string => {
            const item = getMappedItem(category);
            return item?.unit || fallback;
        };

        // Pole items
        const poleRate = getRate('POLE');
        if (poleCount > 0) {
            const amount = poleCount * poleRate;
            gisItems.push({
                itemCategory: 'POLE',
                itemCode: getItemCode('POLE', 'POLE-001'),
                description: getDescription('POLE', 'Fiber Optic Pole - Wooden/Concrete'),
                unit: getUnit('POLE', 'Nos'),
                quantity: poleCount,
                unitRate: poleRate,
                amount,
                sourceType: gisMapping['POLE'] ? 'MAPPED' : 'AUTO_CALCULATED',
                sourceReference: `GIS auto-count: ${poleCount} poles`
            });
        }

        // Chamber items
        const chamberRate = getRate('CHAMBER');
        if (chamberCount > 0) {
            const amount = chamberCount * chamberRate;
            gisItems.push({
                itemCategory: 'CHAMBER',
                itemCode: getItemCode('CHAMBER', 'CHMB-001'),
                description: getDescription('CHAMBER', 'Fiber Optic Chamber / Manhole'),
                unit: getUnit('CHAMBER', 'Nos'),
                quantity: chamberCount,
                unitRate: chamberRate,
                amount,
                sourceType: gisMapping['CHAMBER'] ? 'MAPPED' : 'AUTO_CALCULATED',
                sourceReference: `GIS auto-count: ${chamberCount} chambers`
            });
        }

        // Closure items
        const closureRate = getRate('CLOSURE');
        if (closureCount > 0) {
            const amount = closureCount * closureRate;
            gisItems.push({
                itemCategory: 'CLOSURE',
                itemCode: getItemCode('CLOSURE', 'CLSR-001'),
                description: getDescription('CLOSURE', 'Fiber Optic Splice Closure'),
                unit: getUnit('CLOSURE', 'Nos'),
                quantity: closureCount,
                unitRate: closureRate,
                amount,
                sourceType: gisMapping['CLOSURE'] ? 'MAPPED' : 'AUTO_CALCULATED',
                sourceReference: `GIS auto-count: ${closureCount} closures`
            });
        }

        // Cable items
        const cableRate = getRate('CABLE');
        if (cableSegmentCount > 0) {
            const amount = totalCableLength * cableRate;
            gisItems.push({
                itemCategory: 'CABLE',
                itemCode: getItemCode('CABLE', 'CBL-001'),
                description: getDescription('CABLE', 'Fiber Optic Cable'),
                unit: getUnit('CABLE', 'Meters'),
                quantity: totalCableLength,
                unitRate: cableRate,
                amount,
                sourceType: gisMapping['CABLE'] ? 'MAPPED' : 'AUTO_CALCULATED',
                sourceReference: `GIS auto-sum: ${cableSegmentCount} segments totaling ${totalCableLength}m`
            });
        }

        const totalEstimated = gisItems.reduce((sum, item) => sum + item.amount, 0);

        // Create GISGeneratedBOQ in DB
        const boq = await prisma.gISGeneratedBOQ.create({
            data: {
                routeId,
                projectId,
                status: 'DRAFT',
                totalEstimated,
                notes: notes || null,
                createdById: createdById || userId || null,
                items: {
                    create: gisItems
                }
            },
            include: {
                items: true,
                route: {
                    select: {
                        id: true,
                        name: true,
                        routeLength: true,
                        calculatedPoles: true
                    }
                }
            }
        });

        // Map and build ProjectBOQItems
        const projectBOQItems = gisItems.map((item, idx) => {
            const stockInfo = stockByCategory.get(item.itemCategory);
            let source: 'EXISTING' | 'NEW' = 'NEW';
            let materialId: string | undefined;
            let remarks = item.sourceReference;

            if (stockInfo && stockInfo.availableQty >= item.quantity) {
                source = 'EXISTING';
                materialId = stockInfo.materialId;
                remarks = `${item.sourceReference} | Available in stock: ${stockInfo.availableQty} ${item.unit} (${stockInfo.itemCode})`;
            } else if (stockInfo && stockInfo.availableQty > 0) {
                source = 'NEW';
                materialId = stockInfo.materialId;
                remarks = `${item.sourceReference} | Partial stock: ${stockInfo.availableQty}/${item.quantity} ${item.unit} available (${stockInfo.itemCode})`;
            } else {
                source = 'NEW';
                remarks = `${item.sourceReference} | No stock available — procurement required`;
            }

            return {
                projectId,
                itemCode: `${item.itemCode}-${String(idx + 1).padStart(2, '0')}`,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitRate: item.unitRate,
                amount: item.amount,
                category: item.itemCategory,
                source,
                materialId: materialId || null,
                remarks
            };
        });

        const existingCount = projectBOQItems.filter(i => i.source === 'EXISTING').length;
        const newCount = projectBOQItems.filter(i => i.source === 'NEW').length;

        let boqItemsCreated = 0;
        if (projectBOQItems.length > 0) {
            // Delete old auto-generated items
            const existingItems = await prisma.projectBOQItem.findMany({
                where: {
                    projectId,
                    remarks: { contains: 'GIS auto' }
                }
            });

            if (existingItems.length > 0) {
                await prisma.projectBOQItem.deleteMany({
                    where: { id: { in: existingItems.map(i => i.id) } }
                });
            }

            await prisma.projectBOQItem.createMany({
                data: projectBOQItems
            });
            boqItemsCreated = projectBOQItems.length;
        }

        // Update project budget
        if (totalEstimated > 0) {
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    budget: totalEstimated
                }
            });
        }

        // Update GIS route status
        await prisma.gISRoute.update({
            where: { id: routeId },
            data: { status: 'BOQ_GENERATED' }
        });

        // Auto-update project progress
        await updateProgressOnBOQGenerate(projectId);

        return {
            ...boq,
            projectBOQItemsCreated: boqItemsCreated,
            sourceBreakdown: { existing: existingCount, new: newCount },
            message: `BOQ generated: ${gisItems.length} GIS items, ${boqItemsCreated} project BOQ items synced (${existingCount} existing in stock, ${newCount} to procure)`
        };
    }

    /**
     * Fetch a specific GIS route with elements
     */
    static async getRoute(routeId: string) {
        return await prisma.gISRoute.findUnique({
            where: { id: routeId },
            include: {
                poles: { orderBy: { poleNumber: 'asc' } },
                chambers: true,
                closures: { orderBy: { closureNumber: 'asc' } },
                cableSegments: { orderBy: { segmentNumber: 'asc' } },
                generatedBOQs: true
            }
        });
    }

    /**
     * Update a GIS route
     */
    static async updateRoute(
        projectId: string,
        routeId: string,
        data: {
            name?: string;
            description?: string | null;
            routeLength?: string | number | null;
            poleSpacing?: string | number | null;
            status?: string;
            geojsonData?: any;
            isActive?: boolean;
        },
        userId: string
    ) {
        const { name, description, routeLength, poleSpacing, status, geojsonData, isActive } = data;

        // Fetch current state before update for audit diff
        const before = await prisma.gISRoute.findUnique({ where: { id: routeId } });

        const route = await prisma.gISRoute.update({
            where: { id: routeId },
            data: {
                name: name ?? undefined,
                description: description !== undefined ? description : undefined,
                routeLength: routeLength !== undefined ? (routeLength ? parseFloat(routeLength.toString()) : null) : undefined,
                poleSpacing: poleSpacing !== undefined ? (poleSpacing ? parseFloat(poleSpacing.toString()) : null) : undefined,
                status: status ?? undefined,
                geojsonData: geojsonData !== undefined ? geojsonData : undefined,
                isActive: isActive !== undefined ? isActive : undefined
            }
        });

        // Build field change diff for audit log
        const fieldChanges: Record<string, { oldValue: unknown; newValue: unknown }>[] = [];
        if (before) {
            if (name !== undefined && before.name !== name) fieldChanges.push({ name: { oldValue: before.name, newValue: name } });
            if (status !== undefined && before.status !== status) fieldChanges.push({ status: { oldValue: before.status, newValue: status } });
            if (routeLength !== undefined && before.routeLength !== (routeLength ? parseFloat(routeLength.toString()) : null)) {
                fieldChanges.push({ routeLength: { oldValue: before.routeLength, newValue: routeLength } });
            }
            if (isActive !== undefined && before.isActive !== isActive) fieldChanges.push({ isActive: { oldValue: before.isActive, newValue: isActive } });
        }

        // Write audit log
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: routeId,
            action: 'ROUTE_UPDATED',
            performedById: userId,
            fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
            routeVersion: route.version,
            source: 'WEB_PORTAL'
        }).catch((e) => console.error('Audit log failed on route update:', e));

        return route;
    }

    /**
     * Delete a GIS route and child elements transactionally
     */
    static async deleteRoute(projectId: string, routeId: string, userId: string) {
        // Fetch route info before deletion for audit record
        const route = await prisma.gISRoute.findUnique({ where: { id: routeId } });

        if (!route) {
            throw new Error('ROUTE_NOT_FOUND');
        }

        // Delete related child entities in correct order via transaction
        await prisma.$transaction(async (tx) => {
            // Nullify OTDR test references first
            await tx.oTDRTest.updateMany({
                where: {
                    cableSegment: { routeId }
                },
                data: {
                    cableSegmentId: null
                }
            });

            await tx.gISGeneratedBOQItem.deleteMany({
                where: { generatedBOQ: { routeId } }
            });
            await tx.gISGeneratedBOQ.deleteMany({
                where: { routeId }
            });
            await tx.gISCableSegment.deleteMany({
                where: { routeId }
            });
            await tx.gISPole.deleteMany({
                where: { routeId }
            });
            await tx.gISClosure.deleteMany({
                where: { routeId }
            });
            await tx.gISChamber.deleteMany({
                where: { routeId }
            });
            await tx.gISRoute.delete({
                where: { id: routeId }
            });
        });

        // Write audit log
        await GISAuditService.logChange({
            projectId,
            entityType: 'GISRoute',
            entityId: routeId,
            action: 'ROUTE_DELETED',
            performedById: userId,
            routeVersion: route.version,
            source: 'WEB_PORTAL'
        }).catch((e) => console.error('Audit log failed after delete:', e));

        return { success: true };
    }

    /**
     * Get planned vs as-built progress elements counts and variances
     */
    static async getRouteProgress(projectId: string, routeId: string) {
        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            include: {
                poles: {
                    select: { id: true, poleNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                chambers: {
                    select: { id: true, chamberNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                closures: {
                    select: { id: true, closureNumber: true, status: true, latitude: true, longitude: true, installationDate: true }
                },
                cableSegments: {
                    select: { id: true, segmentNumber: true, status: true, length: true }
                }
            }
        });

        if (!gisRoute) {
            throw new Error('ROUTE_NOT_FOUND');
        }

        const countByStatus = (items: { status: string }[], status: string) =>
            items.filter(i => i.status === status).length;

        // Poles
        const poleStats = {
            total: gisRoute.poles.length,
            planned: countByStatus(gisRoute.poles, 'PLANNED'),
            installed: countByStatus(gisRoute.poles, 'INSTALLED'),
            verified: countByStatus(gisRoute.poles, 'VERIFIED'),
            progressPercent: gisRoute.poles.length > 0
                ? Math.round((countByStatus(gisRoute.poles, 'INSTALLED') + countByStatus(gisRoute.poles, 'VERIFIED')) / gisRoute.poles.length * 100)
                : 0,
            items: gisRoute.poles
        };

        // Chambers
        const chamberStats = {
            total: gisRoute.chambers.length,
            planned: countByStatus(gisRoute.chambers, 'PLANNED'),
            installed: countByStatus(gisRoute.chambers, 'INSTALLED'),
            verified: countByStatus(gisRoute.chambers, 'VERIFIED'),
            progressPercent: gisRoute.chambers.length > 0
                ? Math.round((countByStatus(gisRoute.chambers, 'INSTALLED') + countByStatus(gisRoute.chambers, 'VERIFIED')) / gisRoute.chambers.length * 100)
                : 0,
            items: gisRoute.chambers
        };

        // Closures
        const closureStats = {
            total: gisRoute.closures.length,
            planned: countByStatus(gisRoute.closures, 'PLANNED'),
            installed: countByStatus(gisRoute.closures, 'INSTALLED'),
            verified: countByStatus(gisRoute.closures, 'VERIFIED'),
            progressPercent: gisRoute.closures.length > 0
                ? Math.round((countByStatus(gisRoute.closures, 'INSTALLED') + countByStatus(gisRoute.closures, 'VERIFIED')) / gisRoute.closures.length * 100)
                : 0,
            items: gisRoute.closures
        };

        // Cable Segments
        const cableStats = {
            total: gisRoute.cableSegments.length,
            totalLength: gisRoute.cableSegments.reduce((sum, s) => sum + (s.length || 0), 0),
            installedLength: gisRoute.cableSegments
                .filter(s => s.status === 'INSTALLED')
                .reduce((sum, s) => sum + (s.length || 0), 0),
            planned: countByStatus(gisRoute.cableSegments, 'PLANNED'),
            installed: countByStatus(gisRoute.cableSegments, 'INSTALLED'),
            progressPercent: gisRoute.cableSegments.length > 0
                ? Math.round(countByStatus(gisRoute.cableSegments, 'INSTALLED') / gisRoute.cableSegments.length * 100)
                : 0,
            items: gisRoute.cableSegments
        };

        // Overall progress
        const totalElements = gisRoute.poles.length + gisRoute.chambers.length + gisRoute.closures.length + gisRoute.cableSegments.length;
        const totalInstalled =
            countByStatus(gisRoute.poles, 'INSTALLED') + countByStatus(gisRoute.poles, 'VERIFIED') +
            countByStatus(gisRoute.chambers, 'INSTALLED') + countByStatus(gisRoute.chambers, 'VERIFIED') +
            countByStatus(gisRoute.closures, 'INSTALLED') + countByStatus(gisRoute.closures, 'VERIFIED') +
            countByStatus(gisRoute.cableSegments, 'INSTALLED');

        const overallProgress = totalElements > 0
            ? Math.round((totalInstalled / totalElements) * 100)
            : 0;

        // Variance tracking
        const plannedPoles = gisRoute.calculatedPoles || gisRoute.poles.length;
        const installedPoles = countByStatus(gisRoute.poles, 'INSTALLED') + countByStatus(gisRoute.poles, 'VERIFIED');
        const poleVariance = plannedPoles - installedPoles;

        const routeLengthMeters = gisRoute.routeLength || 0;
        const installedCableLength = gisRoute.cableSegments
            .filter(s => s.status === 'INSTALLED')
            .reduce((sum, s) => sum + (s.length || 0), 0);

        return {
            routeId,
            routeName: gisRoute.name,
            overallProgress,
            totalElements,
            totalInstalled,
            poleStats,
            chamberStats,
            closureStats,
            cableStats,
            variance: {
                plannedPoles,
                installedPoles,
                poleVariance,
                plannedRouteLengthMeters: routeLengthMeters,
                installedCableLengthMeters: installedCableLength,
                cableLengthVarianceMeters: routeLengthMeters - installedCableLength
            },
            status: gisRoute.status,
            asBuiltComplete: overallProgress === 100
        };
    }

    /**
     * Update elements of a GIS route in bulk
     */
    static async updateGISRouteElements(
        projectId: string,
        routeId: string,
        data: {
            elementType: 'POLE' | 'CHAMBER' | 'CLOSURE' | 'CABLE';
            elementIds: string[];
            status: 'PLANNED' | 'INSTALLED' | 'VERIFIED';
            installationDate?: string | null;
        }
    ) {
        const { elementType, elementIds, status, installationDate } = data;

        // Verify route ownership
        const gisRoute = await prisma.gISRoute.findFirst({
            where: { id: routeId, projectId },
            select: { id: true }
        });

        if (!gisRoute) {
            throw new Error('ROUTE_NOT_FOUND');
        }

        let updatedCount = 0;
        const updateData: any = { status };
        if (installationDate) {
            updateData.installationDate = new Date(installationDate);
        }

        switch (elementType) {
            case 'POLE':
                const poleResult = await prisma.gISPole.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = poleResult.count;
                break;
            case 'CHAMBER':
                const chamberResult = await prisma.gISChamber.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = chamberResult.count;
                break;
            case 'CLOSURE':
                const closureResult = await prisma.gISClosure.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = closureResult.count;
                break;
            case 'CABLE':
                const cableResult = await prisma.gISCableSegment.updateMany({
                    where: { id: { in: elementIds }, routeId },
                    data: updateData
                });
                updatedCount = cableResult.count;
                break;
            default:
                throw new Error('INVALID_ELEMENT_TYPE');
        }

        return {
            updatedCount,
            message: `Updated ${updatedCount} ${elementType}(s) to ${status}`
        };
    }

    /**
     * Fetch GIS mappings and available inventory items for a project
     */
    static async getProjectGISMapping(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, gisMapping: true }
        });

        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        const inventoryItems = await prisma.inventoryItem.findMany({
            where: {
                OR: [
                    { category: 'OSP' },
                    { name: { contains: 'Pole', mode: 'insensitive' } },
                    { name: { contains: 'Cable', mode: 'insensitive' } },
                    { name: { contains: 'Fiber', mode: 'insensitive' } },
                    { name: { contains: 'Chamber', mode: 'insensitive' } },
                    { name: { contains: 'Closure', mode: 'insensitive' } },
                    { name: { contains: 'Splice', mode: 'insensitive' } },
                    { name: { contains: 'Manhole', mode: 'insensitive' } },
                    { name: { contains: 'Duct', mode: 'insensitive' } },
                    { code: { contains: 'POLE', mode: 'insensitive' } },
                    { code: { contains: 'CBL', mode: 'insensitive' } },
                    { code: { contains: 'CHMB', mode: 'insensitive' } },
                    { code: { contains: 'CLSR', mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                unitPrice: true,
                category: true,
                description: true
            },
            orderBy: { name: 'asc' },
            take: 200
        });

        const mappings = (project.gisMapping as Record<string, unknown> | null) || {};

        return {
            mappings,
            inventoryItems
        };
    }

    /**
     * Save enriched GIS mappings for a project
     */
    static async saveProjectGISMapping(projectId: string, mappings: Record<string, { materialId: string }>) {
        // Fetch inventory items to enrich mapping details
        const materialIds = Object.values(mappings).map((m: any) => m.materialId);
        const inventoryItems = await prisma.inventoryItem.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, code: true, name: true, unitPrice: true }
        });

        const itemMap = new Map(inventoryItems.map(i => [i.id, i]));

        // Build enriched mappings
        const enrichedMappings: Record<string, {
            materialId: string;
            itemCode: string;
            name: string;
            unitPrice: number;
            updatedAt: string;
        }> = {};

        for (const [category, mapping] of Object.entries(mappings)) {
            const m = mapping as any;
            const item = itemMap.get(m.materialId);
            enrichedMappings[category] = {
                materialId: m.materialId,
                itemCode: item?.code || '',
                name: item?.name || '',
                unitPrice: item?.unitPrice ? Number(item.unitPrice) : 0,
                updatedAt: new Date().toISOString()
            };
        }

        // Merge with existing gisMapping to preserve other references (e.g. qfieldProjectId)
        const existingProject = await prisma.project.findUnique({
            where: { id: projectId },
            select: { gisMapping: true }
        });
        const existingGisMapping = (existingProject?.gisMapping as Record<string, unknown> | null) || {};
        const mergedMapping = { ...existingGisMapping, ...enrichedMappings };

        await prisma.project.update({
            where: { id: projectId },
            data: { gisMapping: mergedMapping }
        });

        return enrichedMappings;
    }

    /**
     * Create an AI-generated Pre-Survey Route Draft
     */
    static async createPreSurveyRoute(
        projectId: string,
        data: {
            routeName?: string;
            startLat: number;
            startLng: number;
            endLat: number;
            endLng: number;
            cableType?: string;
            fiberCount?: number;
        },
        userId: string
    ) {
        const {
            routeName = 'Pre-Survey AI Route',
            startLat,
            startLng,
            endLat,
            endLng,
            cableType = '24F SM',
            fiberCount = 24,
        } = data;

        // Fetch project details along with Job info to get the Region
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { job: true },
        });

        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        const projectCode = project.projectCode || 'PRJ';
        const region = project.job?.region || undefined;

        // Run AI Route Optimization
        const optResult = await GISAIService.optimizeRoute(
            [startLat, startLng],
            [endLat, endLng],
            projectId,
            {
                allowRestrictedZones: false,
                maxSpanMeters: 50,
                boundsBufferMeters: 500
            }
        );

        const distanceMeters = optResult.estimatedCableLengthMeters;
        const pathCoordinates: [number, number][] = optResult.optimizedPath.map(coord => [coord[1], coord[0]]);

        // Map poles
        const polesData = optResult.autoPoles.map((p, i) => ({
            index: i + 1,
            longitude: p.lon,
            latitude: p.lat,
            poleType: p.type || 'CONCRETE',
            height: 9,
            properties: {
                PL_Number: `${projectCode}-PL-${String(i + 1).padStart(3, '0')}`,
            },
        }));

        if (polesData.length === 0) {
            polesData.push(
                {
                    index: 1,
                    longitude: startLng,
                    latitude: startLat,
                    poleType: 'CONCRETE',
                    height: 9,
                    properties: { PL_Number: `${projectCode}-PL-001` },
                },
                {
                    index: 2,
                    longitude: endLng,
                    latitude: endLat,
                    poleType: 'CONCRETE',
                    height: 9,
                    properties: { PL_Number: `${projectCode}-PL-002` },
                }
            );
        }

        // Place joints
        const jointsData = [
            {
                index: 1,
                latitude: pathCoordinates[0][1],
                longitude: pathCoordinates[0][0],
                jointType: 'INLINE',
                capacity: 48,
                properties: { Joint_Number: `${projectCode}-JT-01` },
            },
            {
                index: 2,
                latitude: pathCoordinates[pathCoordinates.length - 1][1],
                longitude: pathCoordinates[pathCoordinates.length - 1][0],
                jointType: 'TERMINAL',
                capacity: 24,
                properties: { Joint_Number: `${projectCode}-JT-02` },
            },
        ];

        // Construct GeoJSON FeatureCollection
        const features: any[] = [];

        // Cable
        features.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: pathCoordinates,
            },
            properties: {
                layer: 'CABLE',
                cable_type: cableType,
                fiber_count: fiberCount,
                length: distanceMeters,
                label: `${cableType} Cable (${Math.round(distanceMeters)}m)`,
            },
        });

        // Poles
        polesData.forEach((p) => {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [p.longitude, p.latitude],
                },
                properties: {
                    layer: 'POLE',
                    pole_number: p.properties.PL_Number,
                    pole_type: p.poleType,
                    height: p.height,
                },
            });
        });

        // Joints
        jointsData.forEach((j) => {
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [j.longitude, j.latitude],
                },
                properties: {
                    layer: 'FIBER_JOINT',
                    joint_number: j.properties.Joint_Number,
                    joint_type: j.jointType,
                },
            });
        });

        const geojsonData = {
            type: 'FeatureCollection',
            features,
        };

        // Run BOQ Engine
        const layersMap = new Map<GISLayerType, any>();
        layersMap.set('CABLE', {
            layerName: 'CABLE',
            featureCount: 1,
            totalLength: distanceMeters,
            cableType,
            fiberCount,
            segments: [{
                index: 1,
                coordinates: pathCoordinates,
                length: distanceMeters,
                cableType,
                fiberCount,
            }],
        } as ParsedCableData);

        layersMap.set('POLE', {
            layerName: 'POLE',
            featureCount: polesData.length,
            poles: polesData.map(p => ({
                index: p.index,
                latitude: p.latitude,
                longitude: p.longitude,
                poleType: p.poleType,
                height: p.height,
                properties: p.properties,
            })),
        } as ParsedPoleData);

        layersMap.set('FIBER_JOINT', {
            layerName: 'FIBER_JOINT',
            featureCount: 2,
            joints: jointsData.map(j => ({
                index: j.index,
                latitude: j.latitude,
                longitude: j.longitude,
                jointType: j.jointType,
                capacity: j.capacity,
                properties: j.properties,
            })),
        } as ParsedFiberJointData);

        const boqEngine = new BOQEngine();
        const boq = boqEngine.generateBOQ(layersMap, region, 1.0);

        // Save GISRoute and elements
        const newRoute = await prisma.gISRoute.create({
            data: {
                projectId,
                name: routeName,
                status: 'PLANNED',
                routeLength: distanceMeters,
                geojsonData,
                isActive: true,
            },
        });

        // Create Poles
        await prisma.gISPole.createMany({
            data: polesData.map(p => ({
                routeId: newRoute.id,
                poleNumber: p.index,
                poleType: p.poleType,
                height: p.height,
                latitude: p.latitude,
                longitude: p.longitude,
                properties: p.properties,
            })),
        });

        // Create Closures
        await prisma.gISClosure.createMany({
            data: jointsData.map(j => ({
                routeId: newRoute.id,
                closureNumber: j.index,
                closureType: j.jointType,
                capacity: j.capacity,
                latitude: j.latitude,
                longitude: j.longitude,
                properties: j.properties,
            })),
        });

        // Create Cable
        await prisma.gISCableSegment.create({
            data: {
                routeId: newRoute.id,
                segmentNumber: 1,
                length: distanceMeters,
                cableType,
                fiberCount,
                properties: { coordinates: pathCoordinates },
            },
        });

        // Save BOQ in database
        if (boq.items.length > 0) {
            const generatedBOQ = await prisma.gISGeneratedBOQ.create({
                data: {
                    routeId: newRoute.id,
                    projectId,
                    status: 'DRAFT',
                    totalEstimated: boq.totalEstimatedCost,
                    createdById: userId || 'system',
                },
            });

            await prisma.gISGeneratedBOQItem.createMany({
                data: boq.items.map((item, idx) => ({
                    boqId: generatedBOQ.id,
                    itemCategory: item.category,
                    itemCode: item.itemCode || `BOQ-${projectCode}-${item.category.substring(0, 3)}-${String(idx + 1).padStart(2, '0')}`,
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    unitRate: item.unitRate,
                    amount: item.amount,
                    sourceType: 'AUTO_CALCULATED',
                    sourceReference: 'AI Pre-Survey Design',
                })),
            });

            // Sync to ProjectBOQItem
            const categoryCounters: Record<string, number> = {};
            await prisma.projectBOQItem.createMany({
                data: boq.items.map((item) => {
                    const catKey = item.category.substring(0, 3);
                    categoryCounters[catKey] = (categoryCounters[catKey] || 0) + 1;
                    const seq = String(categoryCounters[catKey]).padStart(2, '0');
                    return {
                        projectId,
                        category: item.category,
                        itemCode: item.itemCode || `BOQ-${projectCode}-${catKey}-${seq}`,
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        unitRate: Math.round(item.unitRate * 100) / 100,
                        amount: Math.round(item.amount * 100) / 100,
                        source: 'NEW',
                        remarks: 'Generated via AI Pre-Survey Design',
                    };
                }),
            });

            // Update project budget
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    budget: boq.totalEstimatedCost,
                },
            });
        }

        // Create Audit Log entry
        await prisma.gISAuditLog.create({
            data: {
                projectId,
                performedById: userId || 'system',
                action: 'PRE_SURVEY_AI_GENERATED',
                entityType: 'GISRoute',
                entityId: newRoute.id,
                source: 'WEB_PORTAL',
                fieldChanges: {
                    distanceMeters: Math.round(distanceMeters),
                    polesCount: polesData.length,
                    estimatedCost: boq.totalEstimatedCost,
                }
            },
        });

        return {
            success: true,
            routeId: newRoute.id,
            distanceMeters: Math.round(distanceMeters),
            polesCount: polesData.length,
            estimatedCost: boq.totalEstimatedCost,
        };
    }
}

