import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { DATABASE_CLIENT } from '../../database/database.constants';
import { PriceCandidateQueryService } from './price-candidate-query.service';
import { PriceSelectionService } from './price-selection.service';

describe('PricesService', () => {
  let service: PricesService;
  const mockDb = {
    execute: jest.fn(),
    select: jest.fn(),
  };
  const mockCandidateQuery = {
    fetchCandidatesForStations: jest.fn(),
  };
  const mockSelection = {
    selectBestByStationAndFuel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: DATABASE_CLIENT, useValue: mockDb },
        {
          provide: PriceCandidateQueryService,
          useValue: mockCandidateQuery,
        },
        { provide: PriceSelectionService, useValue: mockSelection },
      ],
    }).compile();

    service = module.get(PricesService);
    jest.clearAllMocks();
  });

  it('maps selected latest prices to API shape', async () => {
    const observedAt = new Date('2026-08-15T10:00:00.000Z');
    mockCandidateQuery.fetchCandidatesForStations.mockResolvedValue([
      {
        observationId: 'obs-1',
        stationId: 'station-1',
        fuelTypeId: 'fuel-1',
        fuelCode: 'e10',
        fuelNameEn: 'E10',
        dataSourceId: 'source-1',
        dataSourceCode: 'fi-official',
        dataSourceName: 'Official',
        dataSourceType: 'official',
        sourceTrustWeight: 85,
        price: '1.9290',
        currencyCode: 'EUR',
        observedAt,
        receivedAt: new Date('2026-08-15T10:00:01.000Z'),
        observationConfidence: null,
      },
    ]);
    mockSelection.selectBestByStationAndFuel.mockReturnValue(
      new Map([
        [
          'station-1:fuel-1',
          {
            observationId: 'obs-1',
            stationId: 'station-1',
            fuelTypeId: 'fuel-1',
            fuelCode: 'e10',
            fuelNameEn: 'E10',
            dataSourceId: 'source-1',
            dataSourceCode: 'fi-official',
            dataSourceName: 'Official',
            dataSourceType: 'official',
            sourceTrustWeight: 85,
            price: '1.9290',
            currencyCode: 'EUR',
            observedAt,
            receivedAt: new Date('2026-08-15T10:00:01.000Z'),
            ageSeconds: 100,
            selectionScore: 0.9,
            confidence: '0.8500',
          },
        ],
      ]),
    );

    const result = await service.findLatestByStation('station-1');
    expect(result[0]?.price).toBe('1.9290');
    expect(result[0]?.fuelCode).toBe('e10');
    expect(result[0]?.source?.type).toBe('official');
  });
});
