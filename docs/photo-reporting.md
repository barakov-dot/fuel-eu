# Photo-assisted price reporting

Milestone 11 adds optional photo evidence for crowdsourced fuel price reports. OCR suggests prices; users must explicitly confirm or edit values before submission through the existing Milestone 10 report pipeline.

## Product rule

**OCR never publishes a fuel price directly.** Detected values are suggestions only. Final confirmed user input passes the same validation, confidence, reputation, price selection, and anti-abuse logic as manual reports.

## Flow

1. User chooses **Use photo** on a station detail page.
2. User takes or selects a photo of the price board.
3. API stores a **normalized sanitized JPEG** (EXIF/metadata stripped).
4. In-process OCR runs asynchronously; client polls `GET /report-images/:id`.
5. UI shows candidate fuel/price pairs.
6. User edits and selects candidates, then **Confirm and submit**.
7. Frontend calls existing `POST /stations/:stationId/reports` with optional `reportImageId`.

Multiple fuels from one board are supported by submitting multiple reports linked to the same image.

## Storage

- Abstraction: `ImageStorageProvider`
- Default: `LocalImageStorageProvider` at `IMAGE_STORAGE_PATH` (default `./data/uploads`)
- DB stores `storage_key` only (example `reports/{uuid}.jpg`), never client filenames
- Policy: store normalized evidence image only (no giant original retained)
- Future: S3-compatible provider can replace local storage without API changes

## Privacy

- EXIF/GPS/device metadata stripped during Sharp normalization
- Images remain **private** in this milestone (owner-only content endpoint)
- Public UI may show **Photo verified**, not the image itself
- Account deletion removes unattached private images; historical reports remain without image

## OCR architecture

```
upload → ImagePreprocessorService → storage
      → OcrJob (in-process) → OcrProvider.recognize()
      → FuelPriceExtractorService → stored candidates
      → user confirmation → existing crowdsourcing report create
```

- Provider interface: `OcrProvider`
- Default provider: **Tesseract.js** (`eng` only, worker reused per process, lazy init)
- Concurrency: `OCR_MAX_CONCURRENCY` semaphore (default `1`)
- Queue cap: `OCR_MAX_QUEUE_LENGTH` (returns failed status when exceeded)
- Jobs are **not durable** across process restart (future queue out of scope)

## Preprocessing (Sharp)

1. Validate signature/MIME and pixel limits (10 MB upload, 8000×8000 max dimension, 40 MP max pixels)
2. Auto-orient via EXIF then strip metadata (no `keepExif`)
3. Resize longest edge to 2400px if larger
4. Grayscale + normalize + sharpen
5. Output JPEG quality 85

## Candidate extraction

Heuristic domain service (`FuelPriceExtractorService`):

- Price patterns: `1.799`, `1,799`, etc. within report bounds
- Fuel labels via canonical `fuel_types` + `fuel_aliases`
- Spatial association: nearest price token to label on same line / bounding boxes
- OCR candidate confidence combines OCR score, label match, price plausibility (separate from report confidence)

## Report confidence effect

Linked confirmed photo adds **+0.05** bounded boost in `ConfidenceService`. Photo alone does not bypass anomaly checks or make a report trusted.

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/stations/:stationId/report-images` | Session |
| GET | `/report-images/:id` | Owner |
| GET | `/report-images/:id/content` | Owner (stream) |
| DELETE | `/report-images/:id` | Owner |

Report create extension:

```json
{
  "fuelTypeId": "...",
  "price": "1.6790",
  "currency": "EUR",
  "reportImageId": "...",
  "ocrAssisted": true,
  "originalCandidate": { "rawLabel": "DIESEL 1.679", "price": "1.679" }
}
```

## Retention / cleanup

Unattached images expire after **24 hours**.

```bash
pnpm cleanup:report-images
```

Future scheduled cleanup can call the same command.

## Security limits

- Random internal storage keys (path traversal blocked)
- Decoder re-encode boundary via Sharp
- Reject SVG/PDF/binaries
- Per-user upload throttling
- No base64 in JSON responses

## Supported formats

JPEG, PNG, WebP, HEIC/HEIF (when Sharp/libvips supports decoding on host).

## Environment

```env
IMAGE_STORAGE_PATH=./data/uploads
OCR_PROVIDER=tesseract
OCR_MAX_CONCURRENCY=1
```

## Limitations

- No cloud OCR/AI APIs
- No public photo gallery or moderation UI
- In-process OCR jobs lost on restart
- OCR quality varies; manual fallback always available

## Future

Replaceable OCR providers, durable queue, S3 storage, optional public evidence policy, GPS verification from EXIF (not stored now).
