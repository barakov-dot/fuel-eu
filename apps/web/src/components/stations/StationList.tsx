'use client';

import { useDictionary } from '@/components/i18n/I18nProvider';
import { StatusMessage } from '@/components/ui/StatusMessage';
import type { NearbyStation } from '@/lib/api/types';
import { StationCard } from '@/components/stations/StationCard';
import styles from './StationList.module.css';

type StationListProps = {
  stations: NearbyStation[];
  loading: boolean;
  error: string | null;
  notice?: string | null;
  selectedStationId?: string;
  fuelTypeId?: string;
  onSelect: (stationId: string) => void;
  onCenter: (stationId: string) => void;
};

export function StationList({
  stations,
  loading,
  error,
  notice,
  selectedStationId,
  fuelTypeId,
  onSelect,
  onCenter,
}: StationListProps) {
  const dict = useDictionary();

  if (loading) {
    return <StatusMessage>{dict.stations.loading}</StatusMessage>;
  }

  if (error) {
    return <StatusMessage variant="error">{error}</StatusMessage>;
  }

  if (stations.length === 0) {
    return <StatusMessage>{dict.stations.noResults}</StatusMessage>;
  }

  return (
    <div className={styles.list}>
      <h2 className={styles.title}>{dict.stations.nearbyTitle}</h2>
      {notice ? <StatusMessage>{notice}</StatusMessage> : null}
      <div className={styles.items}>
        {stations.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            selected={station.id === selectedStationId}
            fuelTypeId={fuelTypeId}
            onSelect={onSelect}
            onCenter={onCenter}
          />
        ))}
      </div>
    </div>
  );
}
