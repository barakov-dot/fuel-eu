import type { OcrProvider } from '../../ocr-provider.interface';
import type { OcrResult } from '../../ocr.types';

export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';

  recognize(): Promise<OcrResult> {
    return Promise.resolve({
      text: 'E10 1.799\nDIESEL 1.679\n98 1.899',
      confidence: 0.9,
      lines: [
        {
          text: 'E10 1.799',
          confidence: 0.92,
          bbox: { x0: 10, y0: 10, x1: 200, y1: 40 },
          words: [
            {
              text: 'E10',
              confidence: 0.95,
              bbox: { x0: 10, y0: 10, x1: 60, y1: 40 },
            },
            {
              text: '1.799',
              confidence: 0.9,
              bbox: { x0: 120, y0: 10, x1: 200, y1: 40 },
            },
          ],
        },
        {
          text: 'DIESEL 1.679',
          confidence: 0.91,
          bbox: { x0: 10, y0: 50, x1: 240, y1: 80 },
          words: [
            {
              text: 'DIESEL',
              confidence: 0.93,
              bbox: { x0: 10, y0: 50, x1: 100, y1: 80 },
            },
            {
              text: '1.679',
              confidence: 0.88,
              bbox: { x0: 150, y0: 50, x1: 240, y1: 80 },
            },
          ],
        },
        {
          text: '98 1.899',
          confidence: 0.9,
          bbox: { x0: 10, y0: 90, x1: 200, y1: 120 },
          words: [
            {
              text: '98',
              confidence: 0.9,
              bbox: { x0: 10, y0: 90, x1: 40, y1: 120 },
            },
            {
              text: '1.899',
              confidence: 0.89,
              bbox: { x0: 120, y0: 90, x1: 200, y1: 120 },
            },
          ],
        },
      ],
    });
  }
}
