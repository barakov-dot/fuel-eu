export type OcrBoundingBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: OcrBoundingBox;
};

export type OcrLine = {
  text: string;
  confidence: number;
  words: OcrWord[];
  bbox: OcrBoundingBox;
};

/** Provider-neutral OCR output. */
export type OcrResult = {
  text: string;
  lines: OcrLine[];
  confidence: number;
};

export type FuelPriceCandidate = {
  fuelCodeSuggestion: string;
  fuelTypeId: string | null;
  rawLabel: string;
  price: string;
  confidence: number;
};

export type ReportImageCandidateResponse = {
  fuelCodeSuggestion: string;
  fuelTypeId: string | null;
  rawLabel: string;
  price: string;
  confidence: number;
};

export type ReportImageStatusResponse = {
  id: string;
  status: string;
  stationId: string;
  width: number;
  height: number;
  mimeType: string;
  createdAt: string;
  candidates: ReportImageCandidateResponse[];
  failureReason?: string;
};

export type OriginalCandidateMetadata = {
  fuelCodeSuggestion?: string;
  rawLabel?: string;
  price?: string;
  confidence?: number;
};
