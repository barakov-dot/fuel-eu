import type { OcrResult } from '../ocr.types';
import { FuelPriceExtractorService } from './fuel-price-extractor.service';

describe('FuelPriceExtractorService', () => {
  const aliasEntries = [
    { fuelTypeId: 'fuel-e10', fuelCode: 'E10', alias: 'E10' },
    { fuelTypeId: 'fuel-e10', fuelCode: 'E10', alias: 'SP95E10' },
    { fuelTypeId: 'fuel-diesel', fuelCode: 'DIESEL', alias: 'DIESEL' },
    { fuelTypeId: 'fuel-diesel', fuelCode: 'DIESEL', alias: 'GAZOLE' },
    { fuelTypeId: 'fuel-e5', fuelCode: 'E5', alias: 'E5' },
    { fuelTypeId: 'fuel-e5', fuelCode: 'E5', alias: '98' },
    { fuelTypeId: 'fuel-e5', fuelCode: 'E5', alias: '95' },
  ];

  const service = new FuelPriceExtractorService({} as never, aliasEntries);

  const ocrFromText = (text: string): OcrResult => ({
    text,
    confidence: 0.9,
    lines: text.split('\n').map((line, index) => ({
      text: line,
      confidence: 0.9,
      bbox: { x0: 0, y0: index * 40, x1: 300, y1: index * 40 + 30 },
      words: line.split(/\s+/).map((word, wordIndex) => ({
        text: word,
        confidence: 0.9,
        bbox: {
          x0: wordIndex * 80,
          y0: index * 40,
          x1: wordIndex * 80 + 70,
          y1: index * 40 + 30,
        },
      })),
    })),
  });

  it('extracts E10 price from simple line', async () => {
    const candidates = await service.extractCandidates(
      ocrFromText('E10 1.799'),
    );
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fuelCodeSuggestion: 'E10',
          price: '1.799',
        }),
      ]),
    );
  });

  it('normalizes comma decimal for diesel', async () => {
    const candidates = await service.extractCandidates(
      ocrFromText('DIESEL 1,679'),
    );
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fuelCodeSuggestion: 'DIESEL',
          price: '1.679',
        }),
      ]),
    );
  });

  it('extracts multiple fuel prices from one board', async () => {
    const candidates = await service.extractCandidates(
      ocrFromText('95 E10 1.799\n98 E5 1.899'),
    );
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores implausible prices', async () => {
    const candidates = await service.extractCandidates(
      ocrFromText('E10 99.9999'),
    );
    expect(candidates).toHaveLength(0);
  });

  it('normalizePrice handles comma decimals safely', () => {
    expect(service.normalizePrice('1,799')).toBe('1.799');
    expect(service.normalizePrice('1.799')).toBe('1.799');
    expect(service.normalizePrice('12,345')).toBeNull();
  });
});
