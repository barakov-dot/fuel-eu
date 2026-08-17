import { z } from 'zod';

const nominatimAddressSchema = z
  .object({
    house_number: z.string().optional(),
    road: z.string().optional(),
    neighbourhood: z.string().optional(),
    suburb: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    municipality: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
    country_code: z.string().optional(),
  })
  .passthrough();

export const nominatimSearchResultSchema = z.object({
  place_id: z.number(),
  osm_type: z.string(),
  osm_id: z.number(),
  lat: z.union([z.string(), z.number()]),
  lon: z.union([z.string(), z.number()]),
  display_name: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  addresstype: z.string().optional(),
  address: nominatimAddressSchema.optional(),
  boundingbox: z
    .tuple([z.string(), z.string(), z.string(), z.string()])
    .optional(),
});

export const nominatimSearchResponseSchema = z.array(
  nominatimSearchResultSchema,
);

export const nominatimReverseResultSchema = z.object({
  place_id: z.number(),
  lat: z.union([z.string(), z.number()]),
  lon: z.union([z.string(), z.number()]),
  display_name: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  addresstype: z.string().optional(),
  address: nominatimAddressSchema.optional(),
});

export const nominatimReverseErrorSchema = z.object({
  error: z.string(),
});
