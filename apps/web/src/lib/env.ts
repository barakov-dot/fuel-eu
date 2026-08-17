import { z } from 'zod';

const apiBaseUrlSchema = z
  .string()
  .default('http://localhost:3001')
  .refine(
    (value) => value.startsWith('/') || /^https?:\/\//.test(value),
    'Must be an absolute URL or a root-relative path',
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrlSchema,
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .url()
    .default('https://demotiles.maplibre.org/style.json'),
});

export type WebEnv = z.infer<typeof envSchema>;

export function getWebEnv(): WebEnv {
  return envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  });
}

export function getWebEnvSafe(): WebEnv {
  const result = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  });

  if (!result.success) {
    throw new Error(`Invalid web environment: ${result.error.message}`);
  }

  return result.data;
}
