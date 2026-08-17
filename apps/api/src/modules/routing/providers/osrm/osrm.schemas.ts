import { z } from 'zod';

const coordinatePairSchema = z.tuple([z.number(), z.number()]);

export const osrmLineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(coordinatePairSchema).min(2),
});

export const osrmRouteSchema = z.object({
  distance: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
  geometry: osrmLineStringGeometrySchema,
});

export const osrmRouteResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  routes: z.array(osrmRouteSchema).optional(),
});
