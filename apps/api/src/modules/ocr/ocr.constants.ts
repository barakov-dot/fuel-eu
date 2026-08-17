/**
 * Photo evidence + OCR policy constants.
 * See docs/photo-reporting.md.
 */

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 8000;
export const IMAGE_MAX_PIXELS = 40_000_000;
export const IMAGE_OCR_MAX_DIMENSION = 2400;

export const SUPPORTED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const NORMALIZED_IMAGE_MIME = 'image/jpeg';

/** Unattached images expire after this many hours. */
export const UNATTACHED_IMAGE_RETENTION_HOURS = 24;

/** Bounded confidence boost when user confirms a linked photo. */
export const PHOTO_EVIDENCE_CONFIDENCE_BOOST = 0.05;

/** Max in-process OCR jobs waiting + running. */
export const OCR_MAX_QUEUE_LENGTH = 10;

export const UPLOAD_THROTTLE = {
  name: 'report-image-upload',
  ttl: 60_000,
  limit: 6,
} as const;

export const IMAGE_STATUS_POLL_THROTTLE = {
  name: 'report-image-status',
  ttl: 60_000,
  limit: 60,
} as const;
