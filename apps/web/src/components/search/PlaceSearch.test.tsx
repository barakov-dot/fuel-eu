import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { PlaceSearch } from '@/components/search/PlaceSearch';
import * as geocodingApi from '@/lib/api/geocoding';

jest.mock('@/lib/api/geocoding', () => ({
  searchPlaces: jest.fn(),
}));

const mockResult = {
  id: 'mock:city:paris',
  name: 'Paris',
  displayName: 'Paris, Île-de-France, France',
  location: { lat: 48.8566, lon: 2.3522 },
  type: 'city',
  category: 'place',
  address: {
    country: 'France',
    countryCode: 'fr',
    city: 'Paris',
    postcode: '75000',
    road: null,
  },
  boundingBox: null,
};

function renderPlaceSearch(
  props: Partial<React.ComponentProps<typeof PlaceSearch>> = {},
) {
  const onSelect = jest.fn();
  render(
    <I18nProvider locale="en">
      <PlaceSearch
        placeholder="Search places"
        onSelect={onSelect}
        {...props}
      />
    </I18nProvider>,
  );
  return { onSelect };
}

describe('PlaceSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search input', () => {
    renderPlaceSearch();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows results after debounced search', async () => {
    jest.spyOn(geocodingApi, 'searchPlaces').mockResolvedValue({
      items: [mockResult],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPlaceSearch();

    await user.type(screen.getByRole('combobox'), 'Paris');
    jest.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('selects a result on click', async () => {
    jest.spyOn(geocodingApi, 'searchPlaces').mockResolvedValue({
      items: [mockResult],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onSelect } = renderPlaceSearch();

    await user.type(screen.getByRole('combobox'), 'Paris');
    jest.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option', { name: /Paris/i }));
    expect(onSelect).toHaveBeenCalledWith(mockResult);
  });

  it('shows no results message', async () => {
    jest.spyOn(geocodingApi, 'searchPlaces').mockResolvedValue({ items: [] });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderPlaceSearch();

    await user.type(screen.getByRole('combobox'), 'Nowhere');
    jest.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText(/No places found/i)).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation and Enter selection', async () => {
    jest.spyOn(geocodingApi, 'searchPlaces').mockResolvedValue({
      items: [mockResult],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onSelect } = renderPlaceSearch();

    await user.type(screen.getByRole('combobox'), 'Paris');
    jest.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(mockResult);
  });
});
