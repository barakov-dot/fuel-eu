import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'node:crypto';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { FuelPriceExtractorService } from './extraction/fuel-price-extractor.service';
import {
  IMAGE_MAX_BYTES,
  OCR_MAX_QUEUE_LENGTH,
  UNATTACHED_IMAGE_RETENTION_HOURS,
} from './ocr.constants';
import { OCR_PROVIDER, type OcrProvider } from './ocr-provider.interface';
import type {
  OcrLine,
  OriginalCandidateMetadata,
  ReportImageStatusResponse,
} from './ocr.types';
import { OcrSemaphoreService } from './ocr-semaphore.service';
import { ImagePreprocessorService } from './preprocessing/image-preprocessor.service';
import {
  IMAGE_STORAGE_PROVIDER,
  type ImageStorageProvider,
} from './storage/image-storage-provider.interface';

@Injectable()
export class ReportImagesService {
  private readonly logger = new Logger(ReportImagesService.name);
  private pendingJobs = 0;

  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(IMAGE_STORAGE_PROVIDER)
    private readonly storage: ImageStorageProvider,
    @Inject(OCR_PROVIDER)
    private readonly ocrProvider: OcrProvider,
    private readonly preprocessor: ImagePreprocessorService,
    private readonly extractor: FuelPriceExtractorService,
    private readonly semaphore: OcrSemaphoreService,
  ) {}

  async uploadImage(
    userId: string,
    stationId: string,
    file: Express.Multer.File,
  ): Promise<ReportImageStatusResponse> {
    await this.ensureStationExists(stationId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    if (file.size > IMAGE_MAX_BYTES) {
      throw new BadRequestException(
        'Image exceeds maximum upload size (10 MB)',
      );
    }

    const normalized = await this.preprocessor.normalizeUpload(
      file.buffer,
      file.mimetype,
    );

    const duplicate = await this.findRecentDuplicate(userId, normalized.sha256);
    if (duplicate) {
      return this.toStatusResponse(duplicate);
    }

    const storageKey = `reports/${randomUUID()}.jpg`;
    await this.storage.save(storageKey, normalized.buffer);

    const expiresAt = new Date(
      Date.now() + UNATTACHED_IMAGE_RETENTION_HOURS * 60 * 60 * 1000,
    );

    const [image] = await this.db
      .insert(schema.reportImages)
      .values({
        userId,
        stationId,
        storageKey,
        mimeType: normalized.mimeType,
        fileSizeBytes: normalized.buffer.length,
        width: normalized.width,
        height: normalized.height,
        sha256: normalized.sha256,
        status: 'uploaded',
        expiresAt,
      })
      .returning();

    this.scheduleOcr(image.id);

    return this.toStatusResponse(image);
  }

  async getImageStatus(
    userId: string,
    imageId: string,
  ): Promise<ReportImageStatusResponse> {
    const image = await this.getOwnedImageOrThrow(userId, imageId);
    return this.toStatusResponse(image);
  }

  async getImageContent(userId: string, imageId: string) {
    const image = await this.getOwnedImageOrThrow(userId, imageId);
    const buffer = await this.storage.read(image.storageKey);
    return {
      buffer,
      mimeType: image.mimeType,
    };
  }

  async deleteImage(userId: string, imageId: string): Promise<void> {
    const image = await this.getOwnedImageOrThrow(userId, imageId);

    if (image.status === 'attached') {
      throw new BadRequestException(
        'Attached evidence images cannot be deleted',
      );
    }

    await this.softDeleteImage(image.id, image.storageKey);
  }

  async validateImageForReport(
    userId: string,
    stationId: string,
    imageId: string,
  ) {
    const image = await this.getOwnedImageOrThrow(userId, imageId);

    if (image.stationId !== stationId) {
      throw new BadRequestException('Image belongs to a different station');
    }

    if (image.status === 'deleted') {
      throw new BadRequestException('Image is no longer available');
    }

    if (
      !['processed', 'failed', 'uploaded', 'attached'].includes(image.status)
    ) {
      throw new BadRequestException('Image is not ready for attachment');
    }

    return image;
  }

  async linkImageToReport(
    tx: PostgresJsDatabase<typeof schema>,
    reportId: string,
    imageId: string,
    metadata?: {
      ocrAssisted?: boolean;
      originalCandidate?: OriginalCandidateMetadata;
    },
  ): Promise<void> {
    await tx.insert(schema.userPriceReportImages).values({
      reportId,
      imageId,
      ocrAssisted: metadata?.ocrAssisted ?? false,
      originalCandidate: metadata?.originalCandidate ?? null,
    });

    await tx
      .update(schema.reportImages)
      .set({
        status: 'attached',
        expiresAt: null,
      })
      .where(eq(schema.reportImages.id, imageId));
  }

  async imageHasReportLink(imageId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reportId: schema.userPriceReportImages.reportId })
      .from(schema.userPriceReportImages)
      .where(eq(schema.userPriceReportImages.imageId, imageId))
      .limit(1);
    return !!row;
  }

  async deleteUserImages(userId: string): Promise<number> {
    const images = await this.db
      .select()
      .from(schema.reportImages)
      .where(
        and(
          eq(schema.reportImages.userId, userId),
          isNull(schema.reportImages.deletedAt),
        ),
      );

    let removed = 0;
    for (const image of images) {
      const linked = await this.imageHasReportLink(image.id);
      if (linked) {
        continue;
      }
      await this.softDeleteImage(image.id, image.storageKey);
      removed += 1;
    }
    return removed;
  }

  async cleanupExpiredUnattached(): Promise<number> {
    const now = new Date();
    const expired = await this.db
      .select()
      .from(schema.reportImages)
      .where(
        and(
          isNull(schema.reportImages.deletedAt),
          sql`${schema.reportImages.status} IN ('uploaded', 'processing', 'processed', 'failed')`,
          sql`${schema.reportImages.expiresAt} IS NOT NULL`,
          lte(schema.reportImages.expiresAt, now),
        ),
      );

    let removed = 0;
    for (const image of expired) {
      const linked = await this.imageHasReportLink(image.id);
      if (linked) {
        continue;
      }
      await this.softDeleteImage(image.id, image.storageKey);
      removed += 1;
    }
    return removed;
  }

  private scheduleOcr(imageId: string): void {
    if (this.pendingJobs >= OCR_MAX_QUEUE_LENGTH) {
      void this.markFailed(imageId, 'ocr_queue_full');
      return;
    }

    this.pendingJobs += 1;
    void this.processImage(imageId)
      .catch((error) => {
        this.logger.error(
          `OCR failed for image ${imageId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        this.pendingJobs = Math.max(0, this.pendingJobs - 1);
      });
  }

  private async processImage(imageId: string): Promise<void> {
    const [image] = await this.db
      .select()
      .from(schema.reportImages)
      .where(eq(schema.reportImages.id, imageId))
      .limit(1);

    if (!image || image.deletedAt || image.status === 'deleted') {
      return;
    }

    await this.db
      .update(schema.reportImages)
      .set({ status: 'processing' })
      .where(eq(schema.reportImages.id, imageId));

    const started = Date.now();

    try {
      const buffer = await this.storage.read(image.storageKey);
      const ocrResult = await this.semaphore.run(() =>
        this.ocrProvider.recognize(buffer),
      );
      const candidates = await this.extractor.extractCandidates(ocrResult);
      const processingMs = Date.now() - started;

      await this.db.transaction(async (tx) => {
        await tx.insert(schema.reportImageOcrResults).values({
          reportImageId: imageId,
          provider: this.ocrProvider.name,
          rawText: ocrResult.text,
          structuredResult: {
            confidence: ocrResult.confidence,
            candidateCount: candidates.length,
            candidates: candidates.map((candidate) => ({
              fuelCodeSuggestion: candidate.fuelCodeSuggestion,
              fuelTypeId: candidate.fuelTypeId,
              rawLabel: candidate.rawLabel,
              price: candidate.price,
              confidence: candidate.confidence,
            })),
            lines: ocrResult.lines.map((line: OcrLine) => ({
              text: line.text,
              confidence: line.confidence,
              bbox: line.bbox,
            })),
          },
          processingMs,
        });

        await tx
          .update(schema.reportImages)
          .set({ status: 'processed' })
          .where(eq(schema.reportImages.id, imageId));
      });

      this.logger.log(
        JSON.stringify({
          event: 'ocr_processed',
          imageId,
          provider: this.ocrProvider.name,
          processingMs,
          candidateCount: candidates.length,
        }),
      );
    } catch (error) {
      await this.markFailed(
        imageId,
        error instanceof Error ? error.message : 'ocr_failed',
      );
      throw error;
    }
  }

  private async markFailed(imageId: string, reason: string): Promise<void> {
    await this.db
      .update(schema.reportImages)
      .set({ status: 'failed' })
      .where(eq(schema.reportImages.id, imageId));

    this.logger.warn(
      JSON.stringify({
        event: 'ocr_failed',
        imageId,
        reason,
      }),
    );
  }

  private async findRecentDuplicate(userId: string, sha256: string) {
    const cutoff = new Date(
      Date.now() - UNATTACHED_IMAGE_RETENTION_HOURS * 60 * 60 * 1000,
    );
    const [existing] = await this.db
      .select()
      .from(schema.reportImages)
      .where(
        and(
          eq(schema.reportImages.userId, userId),
          eq(schema.reportImages.sha256, sha256),
          isNull(schema.reportImages.deletedAt),
          gt(schema.reportImages.createdAt, cutoff),
          sql`${schema.reportImages.status} != 'deleted'`,
        ),
      )
      .orderBy(desc(schema.reportImages.createdAt))
      .limit(1);

    return existing ?? null;
  }

  private async toStatusResponse(
    image: typeof schema.reportImages.$inferSelect,
  ): Promise<ReportImageStatusResponse> {
    const [ocrResult] = await this.db
      .select()
      .from(schema.reportImageOcrResults)
      .where(eq(schema.reportImageOcrResults.reportImageId, image.id))
      .orderBy(desc(schema.reportImageOcrResults.createdAt))
      .limit(1);

    const structured = ocrResult?.structuredResult as
      | {
          candidates?: ReportImageStatusResponse['candidates'];
        }
      | null
      | undefined;

    return {
      id: image.id,
      status: image.status,
      stationId: image.stationId,
      width: image.width,
      height: image.height,
      mimeType: image.mimeType,
      createdAt: image.createdAt.toISOString(),
      candidates: structured?.candidates ?? [],
      failureReason:
        image.status === 'failed' ? 'OCR processing failed' : undefined,
    };
  }

  private async getOwnedImageOrThrow(
    userId: string,
    imageId: string,
  ): Promise<typeof schema.reportImages.$inferSelect> {
    const [image] = await this.db
      .select()
      .from(schema.reportImages)
      .where(
        and(
          eq(schema.reportImages.id, imageId),
          isNull(schema.reportImages.deletedAt),
        ),
      )
      .limit(1);

    if (!image) {
      throw new NotFoundException('Report image not found');
    }

    if (image.userId !== userId) {
      throw new ForbiddenException('You do not have access to this image');
    }

    return image;
  }

  private async ensureStationExists(stationId: string): Promise<void> {
    const [station] = await this.db
      .select({ id: schema.stations.id })
      .from(schema.stations)
      .where(eq(schema.stations.id, stationId))
      .limit(1);

    if (!station) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }
  }

  private async softDeleteImage(
    imageId: string,
    storageKey: string,
  ): Promise<void> {
    await this.storage.delete(storageKey);
    await this.db
      .update(schema.reportImages)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
      })
      .where(eq(schema.reportImages.id, imageId));
  }
}
