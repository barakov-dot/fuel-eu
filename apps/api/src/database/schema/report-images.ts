import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stations } from './stations';
import { users } from './users';
import { userPriceReports } from './crowdsourcing';
import { reportImageStatusEnum } from './report-images-enums';

export const reportImages = pgTable(
  'report_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sha256: text('sha256').notNull(),
    status: reportImageStatusEnum('status').notNull().default('uploaded'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('report_images_user_created_idx').on(table.userId, table.createdAt),
    index('report_images_status_created_idx').on(table.status, table.createdAt),
    index('report_images_sha256_user_idx').on(table.sha256, table.userId),
    index('report_images_station_idx').on(table.stationId),
  ],
);

export const reportImageOcrResults = pgTable(
  'report_image_ocr_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportImageId: uuid('report_image_id')
      .notNull()
      .references(() => reportImages.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    rawText: text('raw_text'),
    structuredResult: jsonb('structured_result'),
    processingMs: integer('processing_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('report_image_ocr_results_image_idx').on(table.reportImageId),
  ],
);

export const userPriceReportImages = pgTable(
  'user_price_report_images',
  {
    reportId: uuid('report_id')
      .notNull()
      .references(() => userPriceReports.id, { onDelete: 'cascade' }),
    imageId: uuid('image_id')
      .notNull()
      .references(() => reportImages.id, { onDelete: 'restrict' }),
    ocrAssisted: boolean('ocr_assisted').notNull().default(false),
    originalCandidate: jsonb('original_candidate'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reportId, table.imageId] }),
    index('user_price_report_images_image_idx').on(table.imageId),
  ],
);
