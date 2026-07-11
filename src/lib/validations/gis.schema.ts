import { z } from 'zod';

export const createGISRouteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  routeLength: z.union([z.string(), z.number()]).optional().nullable(),
  poleSpacing: z.union([z.string(), z.number()]).optional().nullable(),
  sourceFile: z.string().optional().nullable(),
  sourceFormat: z.string().optional().nullable(),
  geojsonData: z.any().optional().nullable(),
  metadata: z.any().optional().nullable(),
  createdById: z.string().optional().nullable(),
});

export const updateGISRouteSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  routeLength: z.union([z.string(), z.number()]).optional().nullable(),
  poleSpacing: z.union([z.string(), z.number()]).optional().nullable(),
  status: z.string().optional(),
  geojsonData: z.any().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const generateBOQSchema = z.object({
  notes: z.string().optional().nullable(),
  createdById: z.string().optional().nullable(),
});

export const qfieldSyncSchema = z.object({
  action: z.enum(['create_project', 'push_layers', 'full_sync']).optional(),
  qfieldProjectId: z.string().optional().nullable(),
  qgisTemplate: z.string().optional().nullable(),
});

export const updateGISRouteElementsSchema = z.object({
  elementType: z.enum(['POLE', 'CHAMBER', 'CLOSURE', 'CABLE']),
  elementIds: z.array(z.string()).min(1, 'At least one element ID is required'),
  status: z.enum(['PLANNED', 'INSTALLED', 'VERIFIED']),
  installationDate: z.string().optional().nullable(),
});

export const saveGISMappingSchema = z.object({
  mappings: z.record(
    z.string(),
    z.object({
      materialId: z.string().min(1, 'Material ID is required'),
    })
  ),
});

export const createPreSurveySchema = z.object({
  routeName: z.string().optional(),
  startLat: z.number(),
  startLng: z.number(),
  endLat: z.number(),
  endLng: z.number(),
  cableType: z.string().optional(),
  fiberCount: z.number().optional(),
});

export type CreateGISRouteSchema = z.infer<typeof createGISRouteSchema>;
export type UpdateGISRouteSchema = z.infer<typeof updateGISRouteSchema>;
export type GenerateBOQSchema = z.infer<typeof generateBOQSchema>;
export type QFieldSyncSchema = z.infer<typeof qfieldSyncSchema>;
export type UpdateGISRouteElementsSchema = z.infer<typeof updateGISRouteElementsSchema>;
export type SaveGISMappingSchema = z.infer<typeof saveGISMappingSchema>;
export type CreatePreSurveySchema = z.infer<typeof createPreSurveySchema>;

