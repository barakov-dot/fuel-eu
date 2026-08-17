import type { OcrResult } from './ocr.types';

export interface OcrProvider {
  readonly name: string;
  recognize(imageBuffer: Buffer): Promise<OcrResult>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
