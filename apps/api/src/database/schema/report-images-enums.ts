import { pgEnum } from 'drizzle-orm/pg-core';

export const reportImageStatusEnum = pgEnum('report_image_status', [
  'uploaded',
  'processing',
  'processed',
  'failed',
  'attached',
  'deleted',
]);
