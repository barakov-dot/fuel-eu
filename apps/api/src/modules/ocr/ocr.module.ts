import { Module, forwardRef } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { FuelPriceExtractorService } from './extraction/fuel-price-extractor.service';
import { IMAGE_STATUS_POLL_THROTTLE, UPLOAD_THROTTLE } from './ocr.constants';
import { OCR_PROVIDER } from './ocr-provider.interface';
import { OcrSemaphoreService } from './ocr-semaphore.service';
import { TesseractOcrProvider } from './providers/tesseract/tesseract.provider';
import { ImagePreprocessorService } from './preprocessing/image-preprocessor.service';
import { ReportImagesCleanupService } from './report-images-cleanup.service';
import { ReportImagesController } from './report-images.controller';
import { ReportImagesService } from './report-images.service';
import { IMAGE_STORAGE_PROVIDER } from './storage/image-storage-provider.interface';
import { LocalImageStorageProvider } from './storage/local-image-storage.provider';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    ThrottlerModule.forRoot([
      {
        name: UPLOAD_THROTTLE.name,
        ttl: UPLOAD_THROTTLE.ttl,
        limit: UPLOAD_THROTTLE.limit,
      },
      {
        name: IMAGE_STATUS_POLL_THROTTLE.name,
        ttl: IMAGE_STATUS_POLL_THROTTLE.ttl,
        limit: IMAGE_STATUS_POLL_THROTTLE.limit,
      },
    ]),
  ],
  controllers: [ReportImagesController],
  providers: [
    ReportImagesService,
    ReportImagesCleanupService,
    ImagePreprocessorService,
    FuelPriceExtractorService,
    OcrSemaphoreService,
    LocalImageStorageProvider,
    TesseractOcrProvider,
    {
      provide: IMAGE_STORAGE_PROVIDER,
      useExisting: LocalImageStorageProvider,
    },
    {
      provide: OCR_PROVIDER,
      useExisting: TesseractOcrProvider,
    },
  ],
  exports: [ReportImagesService, ReportImagesCleanupService],
})
export class OcrModule {}
