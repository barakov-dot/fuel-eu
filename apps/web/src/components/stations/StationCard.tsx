'use client';

import { FavoriteButton } from '@/components/auth/FavoriteButton';
import Link from 'next/link';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import cardStyles from '@/components/ui/Card.module.css';
import { Card } from '@/components/ui/Card';
import type { NearbyStation } from '@/lib/api/types';
import { formatDistanceMeters } from '@/lib/format/distance';
import { formatFreshness } from '@/lib/format/freshness';
import { formatPrice } from '@/lib/format/price';
import { serviceModeLabel } from '@/lib/stations/coverage';
import { findPriceForFuel } from '@/lib/stations/helpers';
import { t } from '@/lib/i18n/dictionaries';
import styles from './StationCard.module.css';

type StationCardProps = {
  station: NearbyStation;
  selected?: boolean;
  fuelTypeId?: string;
  onSelect: (stationId: string) => void;
  onCenter: (stationId: string) => void;
};

export function StationCard({
  station,
  selected,
  fuelTypeId,
  onSelect,
  onCenter,
}: StationCardProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const selectedPrice = findPriceForFuel(station.prices, fuelTypeId);
  const title =
    station.name ??
    station.brand ??
    dict.stations.unknownName;

  return (
    <Card selected={selected} onClick={() => onSelect(station.id)}>
      <div className={cardStyles.cardHeader}>
        <div>
          <div className={cardStyles.cardTitle}>{title}</div>
          {station.brand && station.name && (
            <div className={cardStyles.cardBrand}>{station.brand}</div>
          )}
        </div>
        <div className={cardStyles.cardPrice}>
          {selectedPrice
            ? formatPrice(selectedPrice.price, selectedPrice.currency, locale)
            : dict.stations.noPriceForFuel}
        </div>
      </div>

      <div className={`${cardStyles.cardMeta} ${styles.meta}`}>
        <span>
          {t(dict.stations.distance, {
            value: formatDistanceMeters(station.distanceMeters, locale),
          })}
        </span>
        {selectedPrice && (
          <span>
            {t(dict.stations.updated, {
              value: formatFreshness(selectedPrice.ageSeconds, dict),
            })}
          </span>
        )}
      </div>

      <div className={cardStyles.cardSubtle}>
        {[station.address.city, station.address.addressLine]
          .filter(Boolean)
          .join(' · ')}
      </div>

      {selectedPrice && (
        <div className={cardStyles.cardSubtle}>
          {t(dict.stations.source, { value: selectedPrice.source.name })}
          {serviceModeLabel(selectedPrice.serviceMode, dict)
            ? ` · ${serviceModeLabel(selectedPrice.serviceMode, dict)}`
            : ''}
        </div>
      )}

      {station.prices.length > 1 && (
        <div className={styles.otherPrices}>
          {station.prices
            .filter((price) => price.fuelType.id !== fuelTypeId)
            .slice(0, 3)
            .map((price) => (
              <span key={price.fuelType.id}>
                {price.fuelType.code.toUpperCase()}:{' '}
                {formatPrice(price.price, price.currency, locale)}
              </span>
            ))}
        </div>
      )}

      <div className={cardStyles.cardActions}>
        <FavoriteButton stationId={station.id} compact />
        <Button
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onCenter(station.id);
          }}
        >
          {dict.nav.centerOnMap}
        </Button>
        <Link
          href={`/${locale}/stations/${station.id}`}
          className={styles.detailsLink}
          onClick={(event) => event.stopPropagation()}
        >
          {dict.nav.viewDetails}
        </Link>
      </div>
    </Card>
  );
}
