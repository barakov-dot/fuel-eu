import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoReportForm } from '@/components/stations/PhotoReportForm';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import * as reportImagesApi from '@/lib/api/report-images';
import * as reportsApi from '@/lib/api/reports';

jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'authenticated', user: { id: 'user-1', email: 'a@test.com' } },
  }),
}));

jest.mock('@/lib/api/report-images');
jest.mock('@/lib/api/reports');

beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:preview'),
    });
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
    });
  }
});

const fuelTypes = [
  { id: 'fuel-diesel', code: 'diesel', nameEn: 'Diesel', category: 'liquid', unit: 'liter' },
  { id: 'fuel-e10', code: 'e10', nameEn: 'E10', category: 'liquid', unit: 'liter' },
];

function renderForm() {
  return render(
    <I18nProvider locale="en">
      <PhotoReportForm
        stationId="station-1"
        fuelTypes={fuelTypes as never}
        onSubmitted={jest.fn()}
        onManualFallback={jest.fn()}
      />
    </I18nProvider>,
  );
}

describe('PhotoReportForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders photo upload option and tips', () => {
    renderForm();
    expect(screen.getByText('Report price from photo')).toBeInTheDocument();
    expect(screen.getByText(/Keep the price board visible/)).toBeInTheDocument();
    expect(screen.getByLabelText('Take or choose a photo')).toBeInTheDocument();
  });

  it('uploads, shows candidates, and submits confirmed report', async () => {
    jest.spyOn(reportImagesApi, 'uploadReportImage').mockResolvedValue({
      id: 'img-1',
      status: 'uploaded',
      stationId: 'station-1',
      width: 640,
      height: 200,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      candidates: [],
    });
    jest.spyOn(reportImagesApi, 'pollReportImageUntilReady').mockResolvedValue({
      id: 'img-1',
      status: 'processed',
      stationId: 'station-1',
      width: 640,
      height: 200,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      candidates: [
        {
          fuelCodeSuggestion: 'DIESEL',
          fuelTypeId: 'fuel-diesel',
          rawLabel: 'DIESEL 1.679',
          price: '1.679',
          confidence: 0.9,
        },
      ],
    });
    jest.spyOn(reportsApi, 'createPriceReport').mockResolvedValue({
      id: 'report-1',
      evidence: { hasPhoto: true, ocrAssisted: true },
    } as never);

    renderForm();

    const file = new File(['abc'], 'board.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Take or choose a photo'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByText('Upload photo'));

    await waitFor(() => {
      expect(screen.getByText('Confirm and submit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm and submit'));

    await waitFor(() => {
      expect(reportsApi.createPriceReport).toHaveBeenCalledWith(
        'station-1',
        expect.objectContaining({
          reportImageId: 'img-1',
          ocrAssisted: true,
          price: '1.679',
        }),
      );
    });
  });

  it('shows manual fallback when OCR finds no candidates', async () => {
    const onManualFallback = jest.fn();
    jest.spyOn(reportImagesApi, 'uploadReportImage').mockResolvedValue({
      id: 'img-2',
      status: 'uploaded',
      stationId: 'station-1',
      width: 640,
      height: 200,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      candidates: [],
    });
    jest.spyOn(reportImagesApi, 'pollReportImageUntilReady').mockResolvedValue({
      id: 'img-2',
      status: 'processed',
      stationId: 'station-1',
      width: 640,
      height: 200,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      candidates: [],
    });

    render(
      <I18nProvider locale="en">
        <PhotoReportForm
          stationId="station-1"
          fuelTypes={fuelTypes as never}
          onManualFallback={onManualFallback}
        />
      </I18nProvider>,
    );

    const file = new File(['abc'], 'board.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Take or choose a photo'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByText('Upload photo'));

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't detect prices. Enter them manually."),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Enter price manually'));
    expect(onManualFallback).toHaveBeenCalled();
  });
});
