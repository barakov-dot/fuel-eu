import { PriceSelectionService } from './price-selection.service';
import type { PriceCandidate } from './price-selection.service';

describe('PriceSelectionService', () => {
  const service = new PriceSelectionService();
  const now = new Date('2026-08-17T12:00:00.000Z');

  const baseCandidate = (
    overrides: Partial<PriceCandidate> & Pick<PriceCandidate, 'dataSourceType'>,
  ): PriceCandidate => ({
    observationId: 'obs-1',
    stationId: 'station-1',
    fuelTypeId: 'fuel-1',
    price: '1.8000',
    currencyCode: 'EUR',
    observedAt: new Date('2026-08-17T11:50:00.000Z'),
    receivedAt: new Date('2026-08-17T11:50:00.000Z'),
    dataSourceId: 'src-1',
    dataSourceCode: 'TEST',
    dataSourceName: 'Test',
    fuelCode: 'diesel',
    fuelNameEn: 'Diesel',
    sourceTrustWeight: 50,
    observationConfidence: 0.8,
    serviceMode: 'unknown',
    confirmationCount: 0,
    disputeCount: 0,
    ...overrides,
  });

  it('prefers recent official over single low-trust community report', () => {
    const official = baseCandidate({
      dataSourceType: 'official',
      sourceTrustWeight: 85,
      price: '1.8000',
      observedAt: new Date('2026-08-17T11:50:00.000Z'),
    });
    const community = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      price: '1.7000',
      observationConfidence: 0.45,
      observedAt: new Date('2026-08-17T11:55:00.000Z'),
    });

    const selected = service.selectBestForFuel([official, community], now);
    expect(selected?.dataSourceType).toBe('official');
  });

  it('may select strong fresh community over stale official', () => {
    const official = baseCandidate({
      dataSourceType: 'official',
      sourceTrustWeight: 85,
      price: '1.8000',
      observedAt: new Date('2026-08-14T12:00:00.000Z'),
    });
    const community = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      price: '1.7200',
      observationConfidence: 0.82,
      confirmationCount: 3,
      observedAt: new Date('2026-08-17T11:50:00.000Z'),
    });

    const selected = service.selectBestForFuel([official, community], now);
    expect(selected?.dataSourceType).toBe('crowdsourced');
  });

  it('rejects low-confidence anomaly community price', () => {
    const official = baseCandidate({
      dataSourceType: 'official',
      sourceTrustWeight: 85,
      price: '1.8000',
      observedAt: new Date('2026-08-17T11:50:00.000Z'),
    });
    const anomaly = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      price: '5.0000',
      observationConfidence: 0.2,
      observedAt: new Date('2026-08-17T11:55:00.000Z'),
    });

    const selected = service.selectBestForFuel([official, anomaly], now);
    expect(selected?.dataSourceType).toBe('official');
  });

  it('selects community-only price when no official exists', () => {
    const community = baseCandidate({
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      observationConfidence: 0.7,
      confirmationCount: 1,
    });

    const selected = service.selectBestForFuel([community], now);
    expect(selected?.price).toBe('1.8000');
    expect(selected?.verification?.confirmations).toBe(1);
  });

  it('prefers fresh Germany third_party price over weak community report', () => {
    const germany = baseCandidate({
      dataSourceType: 'third_party',
      dataSourceCode: 'DE_TANKERKOENIG_MTSK',
      dataSourceName: 'Tankerkönig / MTS-K Germany',
      sourceTrustWeight: 85,
      price: '1.7890',
      observedAt: new Date('2026-08-17T11:50:00.000Z'),
    });
    const community = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      price: '1.7000',
      observationConfidence: 0.45,
      observedAt: new Date('2026-08-17T11:55:00.000Z'),
    });

    const selected = service.selectBestForFuel([germany, community], now);
    expect(selected?.dataSourceType).toBe('third_party');
  });

  it('may select strong fresh community over stale Germany third_party', () => {
    const germany = baseCandidate({
      dataSourceType: 'third_party',
      dataSourceCode: 'DE_TANKERKOENIG_MTSK',
      sourceTrustWeight: 85,
      price: '1.7890',
      observedAt: new Date('2026-08-14T12:00:00.000Z'),
    });
    const community = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'crowdsourced',
      sourceTrustWeight: 30,
      price: '1.7200',
      observationConfidence: 0.82,
      confirmationCount: 3,
      observedAt: new Date('2026-08-17T11:50:00.000Z'),
    });

    const selected = service.selectBestForFuel([germany, community], now);
    expect(selected?.dataSourceType).toBe('crowdsourced');
  });

  it('prefers self-service over served for the same fuel', () => {
    const self = baseCandidate({
      dataSourceType: 'official',
      sourceTrustWeight: 90,
      price: '1.7990',
      serviceMode: 'self',
    });
    const served = baseCandidate({
      observationId: 'obs-2',
      dataSourceType: 'official',
      sourceTrustWeight: 90,
      price: '2.0490',
      serviceMode: 'served',
    });

    const selected = service.selectBestForFuel([served, self], now);
    expect(selected?.serviceMode).toBe('self');
    expect(selected?.price).toBe('1.7990');
  });

  it('falls back to served when self is unavailable', () => {
    const served = baseCandidate({
      dataSourceType: 'official',
      sourceTrustWeight: 90,
      price: '2.0490',
      serviceMode: 'served',
    });

    const selected = service.selectBestForFuel([served], now);
    expect(selected?.serviceMode).toBe('served');
  });
});
