import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { StationDetailView } from '@/components/stations/StationDetailView';
import { getDictionary } from '@/lib/i18n/dictionaries';

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/stations/station-1',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/components/map/StationMapClient', () => ({
  StationMap: () => <div data-testid="station-map-mock" />,
}));

jest.mock('@/components/auth/FavoriteButton', () => ({
  FavoriteButton: () => null,
}));

jest.mock('@/components/stations/ReportPriceForm', () => ({
  ReportPriceForm: () => null,
}));

jest.mock('@/components/stations/CommunityReportsList', () => ({
  CommunityReportsList: () => null,
  sourceBadgeLabel: () => 'Official',
}));

jest.mock('@/lib/api/stations', () => ({
  fetchStation: jest.fn(),
  fetchStationLatestPrices: jest.fn(),
  fetchStationPriceHistory: jest.fn(),
}));

jest.mock('@/lib/api/fuels', () => ({
  fetchFuelTypes: jest.fn(),
}));

jest.mock('@/lib/api/reports', () => ({
  fetchStationReports: jest.fn().mockResolvedValue({ items: [] }),
  createPriceReport: jest.fn(),
  voteOnReport: jest.fn(),
}));

const { fetchStation, fetchStationLatestPrices, fetchStationPriceHistory } =
  jest.requireMock('@/lib/api/stations');
const { fetchFuelTypes } = jest.requireMock('@/lib/api/fuels');

describe('StationDetailView', () => {
  beforeEach(() => {
    fetchStation.mockResolvedValue({
      id: 'station-1',
      countryId: 'country-1',
      brand: 'Total',
      name: 'Station Alpha',
      addressLine: '1 Rue de Paris',
      postalCode: '75001',
      city: 'Paris',
      phone: null,
      website: null,
      isActive: true,
      latitude: 48.8566,
      longitude: 2.3522,
      countryIso2: 'FR',
      countryNameEn: 'France',
    });
    fetchStationLatestPrices.mockResolvedValue([
      {
        id: 'price-1',
        stationId: 'station-1',
        fuelTypeId: 'fuel-e10',
        fuelCode: 'e10',
        fuelNameEn: 'E10',
        dataSourceId: 'source-1',
        dataSourceCode: 'fr_prix_carburants',
        price: '1.8200',
        currencyId: 'cur-1',
        currencyCode: 'EUR',
        observedAt: '2026-08-17T12:00:00.000Z',
        receivedAt: '2026-08-17T12:00:00.000Z',
      },
    ]);
    fetchFuelTypes.mockResolvedValue([
      {
        id: 'fuel-e10',
        code: 'e10',
        nameEn: 'E10',
        nameRu: 'E10',
        category: 'gasoline',
        octaneRating: 95,
        biofuelPercentage: 10,
        unit: 'liter',
        isActive: true,
      },
    ]);
    fetchStationPriceHistory.mockResolvedValue([]);
  });

  it('renders current prices', async () => {
    render(
      <I18nProvider locale="en">
        <StationDetailView stationId="station-1" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Station Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText(/€1\.82/)).toBeInTheDocument();
    expect(screen.getByText(getDictionary('en').detail.currentPrices)).toBeInTheDocument();
  });

  it('shows history empty state', async () => {
    render(
      <I18nProvider locale="en">
        <StationDetailView stationId="station-1" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(getDictionary('en').detail.historyEmpty),
      ).toBeInTheDocument();
    });
  });
});
