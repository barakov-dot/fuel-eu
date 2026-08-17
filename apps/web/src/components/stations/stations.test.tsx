import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { FuelSelector } from '@/components/filters/FuelSelector';
import { StationList } from '@/components/stations/StationList';
import type { FuelType, NearbyStation } from '@/lib/api/types';
import { getDictionary } from '@/lib/i18n/dictionaries';

jest.mock('@/components/map/StationMapClient', () => ({
  StationMap: () => <div data-testid="station-map-mock" />,
}));

jest.mock('@/components/auth/FavoriteButton', () => ({
  FavoriteButton: () => null,
}));

const fuelTypes: FuelType[] = [
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
  {
    id: 'fuel-diesel',
    code: 'diesel',
    nameEn: 'Diesel',
    nameRu: 'Дизель',
    category: 'diesel',
    octaneRating: null,
    biofuelPercentage: 7,
    unit: 'liter',
    isActive: true,
  },
];

const stations: NearbyStation[] = [
  {
    id: 'station-1',
    name: 'Station Alpha',
    brand: 'Total',
    country: { iso2: 'FR', name: 'France' },
    address: {
      addressLine: '1 Rue de Paris',
      postalCode: '75001',
      city: 'Paris',
    },
    location: { lat: 48.8566, lon: 2.3522 },
    distanceMeters: 420,
    prices: [
      {
        fuelType: { id: 'fuel-e10', code: 'e10', name: 'E10' },
        price: '1.8200',
        currency: 'EUR',
        observedAt: '2026-08-17T12:00:00.000Z',
        ageSeconds: 240,
        source: {
          id: 'source-1',
          code: 'fr_prix_carburants',
          name: 'France official',
          type: 'official',
        },
        confidence: 1,
      },
    ],
  },
];

function renderWithLocale(ui: React.ReactElement, locale: 'en' | 'ru' = 'en') {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>);
}

describe('StationList', () => {
  it('renders returned station data with selected fuel price', () => {
    renderWithLocale(
      <StationList
        stations={stations}
        loading={false}
        error={null}
        fuelTypeId="fuel-e10"
        onSelect={jest.fn()}
        onCenter={jest.fn()}
      />,
    );

    expect(screen.getByText('Station Alpha')).toBeInTheDocument();
    expect(screen.getByText(/€1\.82/)).toBeInTheDocument();
    expect(screen.getByText(/4 min ago/)).toBeInTheDocument();
  });

  it('shows empty nearby result', () => {
    renderWithLocale(
      <StationList
        stations={[]}
        loading={false}
        error={null}
        onSelect={jest.fn()}
        onCenter={jest.fn()}
      />,
    );

    expect(
      screen.getByText(getDictionary('en').stations.noResults),
    ).toBeInTheDocument();
  });

  it('shows API error state', () => {
    renderWithLocale(
      <StationList
        stations={[]}
        loading={false}
        error="API unavailable"
        onSelect={jest.fn()}
        onCenter={jest.fn()}
      />,
    );

    expect(screen.getByText('API unavailable')).toBeInTheDocument();
  });

  it('marks selected station card', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    renderWithLocale(
      <StationList
        stations={stations}
        loading={false}
        error={null}
        selectedStationId="station-1"
        fuelTypeId="fuel-e10"
        onSelect={onSelect}
        onCenter={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Station Alpha/i }));
    expect(onSelect).toHaveBeenCalledWith('station-1');
  });
});

describe('FuelSelector', () => {
  it('renders fuel selector and toggles fuel', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderWithLocale(
      <FuelSelector
        fuelTypes={fuelTypes}
        selectedFuelTypeId="fuel-e10"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'E10' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'E10' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe('i18n', () => {
  it('renders English strings', () => {
    renderWithLocale(
      <StationList
        stations={[]}
        loading={false}
        error={null}
        onSelect={jest.fn()}
        onCenter={jest.fn()}
      />,
      'en',
    );

    expect(
      screen.getByText(getDictionary('en').stations.noResults),
    ).toBeInTheDocument();
  });

  it('renders Russian strings', () => {
    renderWithLocale(
      <StationList
        stations={[]}
        loading={false}
        error={null}
        onSelect={jest.fn()}
        onCenter={jest.fn()}
      />,
      'ru',
    );

    expect(
      screen.getByText(getDictionary('ru').stations.noResults),
    ).toBeInTheDocument();
  });
});
