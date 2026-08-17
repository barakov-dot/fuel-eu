import { Module } from '@nestjs/common';
import { FuelPriceExtractorService } from '../modules/ocr/extraction/fuel-price-extractor.service';
import { OCR_PROVIDER } from '../modules/ocr/ocr-provider.interface';
import { OcrSemaphoreService } from '../modules/ocr/ocr-semaphore.service';
import { ReportImagesCleanupService } from '../modules/ocr/report-images-cleanup.service';
import { ReportImagesService } from '../modules/ocr/report-images.service';
import { ImagePreprocessorService } from '../modules/ocr/preprocessing/image-preprocessor.service';
import { IMAGE_STORAGE_PROVIDER } from '../modules/ocr/storage/image-storage-provider.interface';
import { LocalImageStorageProvider } from '../modules/ocr/storage/local-image-storage.provider';
import { ApplicationCoreModule } from './application-core.module';

const noopOcrProvider = {
  name: 'noop',
  recognize: () =>
    Promise.resolve({
      text: '',
      lines: [],
      confidence: 0,
    }),
};

@Module({
  imports: [ApplicationCoreModule],
  providers: [
    ReportImagesCleanupService,
    ReportImagesService,
    LocalImageStorageProvider,
    ImagePreprocessorService,
    FuelPriceExtractorService,
    OcrSemaphoreService,
    {
      provide: IMAGE_STORAGE_PROVIDER,
      useExisting: LocalImageStorageProvider,
    },
    {
      provide: OCR_PROVIDER,
      useValue: noopOcrProvider,
    },
  ],
  exports: [ReportImagesCleanupService],
})
export class ReportImagesMaintenanceCliModule {}
