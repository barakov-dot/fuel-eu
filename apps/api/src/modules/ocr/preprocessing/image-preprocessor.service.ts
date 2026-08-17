import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_MAX_PIXELS,
  IMAGE_OCR_MAX_DIMENSION,
  NORMALIZED_IMAGE_MIME,
  SUPPORTED_UPLOAD_MIME_TYPES,
} from '../ocr.constants';

export type NormalizedImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sha256: string;
};

@Injectable()
export class ImagePreprocessorService {
  private readonly sharpLimits = {
    limitInputPixels: IMAGE_MAX_PIXELS,
  };

  async normalizeUpload(
    input: Buffer,
    declaredMime?: string,
  ): Promise<NormalizedImage> {
    let pipeline: sharp.Sharp;
    try {
      pipeline = sharp(input, this.sharpLimits);
    } catch {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await pipeline.metadata();
    } catch {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    if (!metadata.format) {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    const detectedMime = this.detectMime(metadata.format, metadata);
    if (!detectedMime || !this.isSupportedMime(detectedMime)) {
      throw new BadRequestException(
        'Unsupported image format. Use JPEG, PNG, WebP, or HEIC.',
      );
    }

    if (declaredMime && !this.mimeCompatible(declaredMime, detectedMime)) {
      throw new BadRequestException(
        'Image content does not match declared type',
      );
    }

    const oriented = await sharp(input, this.sharpLimits).metadata();
    const width = oriented.autoOrient?.width ?? oriented.width ?? 0;
    const height = oriented.autoOrient?.height ?? oriented.height ?? 0;

    if (width <= 0 || height <= 0) {
      throw new BadRequestException('Could not determine image dimensions');
    }

    if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
      throw new BadRequestException(
        `Image dimensions exceed ${IMAGE_MAX_DIMENSION}px limit`,
      );
    }

    const pixels = width * height;
    if (pixels > IMAGE_MAX_PIXELS) {
      throw new BadRequestException('Image pixel count exceeds limit');
    }

    const longestEdge = Math.max(width, height);
    const resizeWidth =
      longestEdge > IMAGE_OCR_MAX_DIMENSION
        ? Math.round((width / longestEdge) * IMAGE_OCR_MAX_DIMENSION)
        : undefined;

    const normalized = await sharp(input, this.sharpLimits)
      .rotate()
      .resize(
        resizeWidth
          ? { width: resizeWidth, withoutEnlargement: true }
          : undefined,
      )
      .grayscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
      .catch(() => {
        throw new BadRequestException('Invalid or unsupported image file');
      });

    const sha256 = createHash('sha256').update(normalized.data).digest('hex');

    return {
      buffer: normalized.data,
      mimeType: NORMALIZED_IMAGE_MIME,
      width: normalized.info.width,
      height: normalized.info.height,
      sha256,
    };
  }

  private detectMime(
    format: sharp.Metadata['format'],
    metadata: sharp.Metadata,
  ): string | null {
    if (metadata.mediaType) {
      return metadata.mediaType;
    }

    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heif':
        return metadata.compression === 'av1' ? 'image/avif' : 'image/heic';
      default:
        return null;
    }
  }

  private isSupportedMime(mime: string): boolean {
    return SUPPORTED_UPLOAD_MIME_TYPES.includes(
      mime as (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number],
    );
  }

  private mimeCompatible(declared: string, detected: string): boolean {
    const normalizedDeclared = declared.toLowerCase();
    const normalizedDetected = detected.toLowerCase();
    if (normalizedDeclared === normalizedDetected) {
      return true;
    }
    if (
      (normalizedDeclared === 'image/heic' ||
        normalizedDeclared === 'image/heif') &&
      (normalizedDetected === 'image/heic' ||
        normalizedDetected === 'image/heif')
    ) {
      return true;
    }
    return false;
  }
}
