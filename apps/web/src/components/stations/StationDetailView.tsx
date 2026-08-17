'use client';

import { FavoriteButton } from '@/components/auth/FavoriteButton';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import {
  useDictionary,
  useLocale,
} from '@/components/i18n/I18nProvider';
import { StationMap } from '@/components/map/StationMapClient';
import { CommunityReportsList, sourceBadgeLabel } from '@/components/stations/CommunityReportsList';
import { PriceHistoryChart } from '@/components/stations/PriceHistoryChart';
import { ReportPriceForm } from '@/components/stations/ReportPriceForm';
import { PhotoReportForm } from '@/components/stations/PhotoReportForm';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { fetchFuelTypes } from '@/lib/api/fuels';
import {
  fetchStation,
  fetchStationLatestPrices,
} from '@/lib/api/stations';
import { ApiError } from '@/lib/api/types';
import type {
  FuelType,
  LatestStationPrice,
  StationDetail,
} from '@/lib/api/types';
import { buildNavigationUrls } from '@/lib/geo/location';
import { formatFreshness } from '@/lib/format/freshness';
import { formatPrice } from '@/lib/format/price';
import { serviceModeLabel } from '@/lib/stations/coverage';
import { t } from '@/lib/i18n/dictionaries';
import badgeStyles from '@/components/stations/CommunityReportsList.module.css';
import styles from './StationDetailView.module.css';

type DisplayPrice = LatestStationPrice & {
  ageSeconds: number;
  source?: { type: string; name: string };
  confidence?: string;
  verification?: { confirmations: number; disputes: number };
};

type StationDetailViewProps = {
  stationId: string;
};

export function StationDetailView({ stationId }: StationDetailViewProps) {
  const dict = useDictionary();
  const locale = useLocale();

  const [station, setStation] = useState<StationDetail | null>(null);
  const [prices, setPrices] = useState<DisplayPrice[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);
  const [reportMode, setReportMode] = useState<'manual' | 'photo'>('manual');

  const loadPrices = async (signal?: AbortSignal) => {
    const pricesResponse = await fetchStationLatestPrices(stationId, signal);
    const loadedAt = Date.now();
    setPrices(
      pricesResponse.map((price) => ({
        ...price,
        ageSeconds: Math.max(
          0,
          Math.floor(
            (loadedAt - new Date(price.observedAt).getTime()) / 1000,
          ),
        ),
      })),
    );
  };

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchStation(stationId, controller.signal),
      fetchStationLatestPrices(stationId, controller.signal),
      fetchFuelTypes(controller.signal),
    ])
      .then(([stationResponse, pricesResponse, fuelTypesResponse]) => {
        const loadedAt = Date.now();
        setStation(stationResponse);
        setPrices(
          pricesResponse.map((price) => ({
            ...price,
            ageSeconds: Math.max(
              0,
              Math.floor(
                (loadedAt - new Date(price.observedAt).getTime()) / 1000,
              ),
            ),
          })),
        );
        setFuelTypes(fuelTypesResponse);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (fetchError instanceof ApiError && fetchError.status === 404) {
          setError(dict.errors.stationNotFound);
        } else {
          setError(
            fetchError instanceof ApiError
              ? fetchError.message
              : dict.errors.apiUnavailable,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [dict.errors.apiUnavailable, dict.errors.stationNotFound, stationId]);

  if (loading) {
    return <StatusMessage>{dict.stations.loading}</StatusMessage>;
  }

  if (error || !station) {
    return <StatusMessage variant="error">{error ?? dict.errors.generic}</StatusMessage>;
  }

  const title = station.name ?? station.brand ?? dict.stations.unknownName;
  const address = [station.addressLine, station.postalCode, station.city]
    .filter(Boolean)
    .join(', ');
  const navUrls = buildNavigationUrls(station.latitude, station.longitude);

  const handleReportSubmitted = () => {
    setReportsRefreshKey((current) => current + 1);
    void loadPrices();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href={`/${locale}`} className={styles.backLink}>
            ← {dict.nav.back}
          </Link>
          <LanguageSelector />
        </div>
        <h1>{title}</h1>
        {station.brand && station.name && (
          <p className={styles.brand}>{station.brand}</p>
        )}
      </header>

      <section className={styles.mapSection}>
        <StationMap
          stations={[
            {
              id: station.id,
              lat: station.latitude,
              lon: station.longitude,
              name: station.name,
              brand: station.brand,
            },
          ]}
          initialCenter={{ lat: station.latitude, lon: station.longitude }}
          initialZoom={15}
          selectedStationId={station.id}
        />
      </section>

      <section className={styles.section}>
        <h2>{dict.detail.address}</h2>
        <p>{address || '—'}</p>
        <p className={styles.subtle}>
          {dict.detail.coordinates}: {station.latitude.toFixed(5)},{' '}
          {station.longitude.toFixed(5)}
        </p>
        <div className={styles.actions}>
          <FavoriteButton stationId={station.id} />
          <Button onClick={() => window.open(navUrls.googleMaps, '_blank', 'noopener,noreferrer')}>
            {dict.nav.navigate}
          </Button>
          <Link
            href={`/${locale}?to=${station.latitude.toFixed(6)},${station.longitude.toFixed(6)}`}
            className={styles.secondaryLink}
          >
            {dict.route.planToStation}
          </Link>
          <a href={navUrls.appleMaps} className={styles.secondaryLink}>
            Apple Maps
          </a>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{dict.detail.currentPrices}</h2>
        {prices.length === 0 ? (
          <StatusMessage>{dict.detail.noPrices}</StatusMessage>
        ) : (
          <ul className={styles.priceList}>
            {prices.map((price) => {
              const sourceType = price.source?.type ?? 'official';
              const badgeClass =
                sourceType === 'crowdsourced'
                  ? badgeStyles.badgeCommunity
                  : sourceType === 'official'
                    ? badgeStyles.badgeOfficial
                    : badgeStyles.badge;

              return (
                <li key={price.id} className={styles.priceItem}>
                  <div>
                    <strong>{price.fuelCode.toUpperCase()}</strong>
                    <div className={styles.subtle}>
                      {t(dict.stations.updated, {
                        value: formatFreshness(price.ageSeconds, dict),
                      })}
                    </div>
                    <span className={`${badgeStyles.badge} ${badgeClass}`}>
                      {sourceBadgeLabel(
                        sourceType,
                        dict,
                        price.verification,
                        price.source?.name,
                      )}
                    </span>
                    {serviceModeLabel(price.serviceMode, dict) && (
                      <span className={`${badgeStyles.badge} ${badgeStyles.badge}`}>
                        {serviceModeLabel(price.serviceMode, dict)}
                      </span>
                    )}
                  </div>
                  <div className={styles.priceValue}>
                    {formatPrice(price.price, price.currencyCode, locale)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.reportModeToggle}>
          <Button
            variant={reportMode === 'manual' ? 'primary' : 'secondary'}
            onClick={() => setReportMode('manual')}
          >
            {dict.community.manualReport}
          </Button>
          <Button
            variant={reportMode === 'photo' ? 'primary' : 'secondary'}
            onClick={() => setReportMode('photo')}
          >
            {dict.community.usePhoto}
          </Button>
        </div>
        {reportMode === 'manual' ? (
          <ReportPriceForm
            stationId={station.id}
            fuelTypes={fuelTypes}
            onSubmitted={handleReportSubmitted}
          />
        ) : (
          <PhotoReportForm
            stationId={station.id}
            fuelTypes={fuelTypes}
            onSubmitted={handleReportSubmitted}
            onManualFallback={() => setReportMode('manual')}
          />
        )}
      </section>

      <section className={styles.section}>
        <h2>{dict.community.communityReports}</h2>
        <CommunityReportsList
          stationId={station.id}
          refreshKey={reportsRefreshKey}
        />
      </section>

      <PriceHistoryChart
        stationId={station.id}
        fuelTypes={fuelTypes}
        initialFuelTypeId={prices[0]?.fuelTypeId}
      />
    </div>
  );
}
