import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, type Worker } from 'tesseract.js';
import type { OcrProvider } from '../../ocr-provider.interface';
import type { OcrLine, OcrResult } from '../../ocr.types';

@Injectable()
export class TesseractOcrProvider implements OcrProvider, OnModuleDestroy {
  readonly name = 'tesseract';
  private readonly logger = new Logger(TesseractOcrProvider.name);
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  async recognize(imageBuffer: Buffer): Promise<OcrResult> {
    await this.ensureWorker();
    if (!this.worker) {
      throw new Error('Tesseract worker is not available');
    }

    const result = await this.worker.recognize(imageBuffer);
    const data = result.data as {
      text: string;
      confidence: number;
      lines?: Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        words?: Array<{
          text: string;
          confidence: number;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;
      }>;
    };

    const lines: OcrLine[] = (data.lines ?? []).map((line) => ({
      text: line.text.trim(),
      confidence: this.normalizeConfidence(line.confidence),
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1,
      },
      words: (line.words ?? []).map((word) => ({
        text: word.text.trim(),
        confidence: this.normalizeConfidence(word.confidence),
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      })),
    }));

    return {
      text: data.text.trim(),
      lines,
      confidence: this.normalizeConfidence(data.confidence),
    };
  }

  private async ensureWorker(): Promise<void> {
    if (this.worker) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.createWorkerInstance();
    }

    await this.initPromise;
  }

  private async createWorkerInstance(): Promise<void> {
    this.logger.log('Initializing Tesseract OCR worker (eng)');
    const cachePath =
      this.configService.get<string>('TESSERACT_CACHE_PATH') ??
      '/app/data/tesseract-cache';
    this.worker = await createWorker('eng', 1, {
      cachePath,
      logger: (message) => {
        if (message.status === 'recognizing text') {
          return;
        }
        this.logger.debug(
          `Tesseract ${message.status}${message.progress ? ` ${Math.round(message.progress * 100)}%` : ''}`,
        );
      },
    });
  }

  private normalizeConfidence(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value / 100));
  }
}
