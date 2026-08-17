import { z } from 'zod';

const austriaPriceSchema = z.object({
  fuelType: z.enum(['DIE', 'SUP', 'GAS']),
  amount: z.number(),
  label: z.string().optional(),
});

const austriaLocationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export const austriaGasStationSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: austriaLocationSchema,
  contact: z
    .object({
      telephone: z.string().optional(),
      mail: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  open: z.boolean().optional(),
  distance: z.number().optional(),
  position: z.number().optional(),
  prices: z.array(austriaPriceSchema),
});

export const austriaGasStationListSchema = z.array(austriaGasStationSchema);

export type AustriaGasStation = z.infer<typeof austriaGasStationSchema>;

export function formatAustriaPrice(amount: number): string {
  return amount.toFixed(3);
}

export function parseAustriaPriceAmount(amount: unknown): number | null {
  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    return amount;
  }
  return null;
}
