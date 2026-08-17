'use client';

import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Card } from '@/components/ui/Card';
import { formatDistanceMeters } from '@/lib/format/distance';
import { formatPrice } from '@/lib/format/price';
import { formatDuration } from '@/lib/geo/route';
import type { RouteStationCandidate, RouteStationsResponse } from '@/lib/api/types';
import styles from './RouteResultsPanel.module.css';

type RouteResultsPanelProps = {
  result: RouteStationsResponse | null;
  loading: boolean;
  error: string | null;
  selectedCandidateId?: string;
  onSelectCandidate: (stationId: string) => void;
};

function savingLabel(
  candidate: RouteStationCandidate,
  locale: string,
  worthDetour: string,
  savedTemplate: string,
): string {
  const effective = Number(candidate.savings.effectiveSaving);
  if (effective <= 0) {
    return worthDetour;
  }
  return savedTemplate.replace(
    '{value}',
    formatPrice(candidate.savings.effectiveSaving, candidate.fuel.currency, locale),
  );
}

export function RouteResultsPanel({
  result,
  loading,
  error,
  selectedCandidateId,
  onSelectCandidate,
}: RouteResultsPanelProps) {
  const dict = useDictionary();
  const locale = useLocale();

  if (loading) {
    return <p className={styles.status}>{dict.route.loadingResults}</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!result) {
    return null;
  }

  return (
    <section className={styles.panel} aria-label={dict.route.resultsTitle}>
      <div className={styles.summary}>
        <h2 className={styles.title}>{dict.route.resultsTitle}</h2>
        <p>
          {formatDistanceMeters(result.route.distanceMeters, locale)} ·{' '}
          {formatDuration(result.route.durationSeconds)}
        </p>
        {result.referencePrice && (
          <p className={styles.meta}>
            {dict.route.referencePrice}:{' '}
            {formatPrice(result.referencePrice, 'EUR', locale)} (
            {result.referencePriceSource === 'user'
              ? dict.route.referenceUser
              : dict.route.referenceMedian}
            )
          </p>
        )}
        <p className={styles.meta}>
          {dict.route.corridorCandidates}: {result.meta.corridorCandidateCount} ·{' '}
          {dict.route.exactCandidates}: {result.meta.exactRoutedCandidateCount}
        </p>
      </div>

      {result.items.length === 0 ? (
        <p className={styles.status}>{dict.route.noCandidates}</p>
      ) : (
        <ul className={styles.list}>
          {result.items.map((candidate) => {
            const title =
              candidate.station.name ??
              candidate.station.brand ??
              dict.stations.unknownName;
            const selected = candidate.station.id === selectedCandidateId;
            const effective = Number(candidate.savings.effectiveSaving);

            return (
              <li key={candidate.station.id}>
                <Card
                  className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
                  onClick={() => onSelectCandidate(candidate.station.id)}
                >
                  <div className={styles.cardHeader}>
                    <strong>{title}</strong>
                    <span className={effective > 0 ? styles.positive : styles.negative}>
                      {savingLabel(
                        candidate,
                        locale,
                        dict.route.notWorthDetour,
                        dict.route.savedAmount,
                      )}
                    </span>
                  </div>
                  <div className={styles.metrics}>
                    <span>
                      {formatPrice(
                        candidate.fuel.price,
                        candidate.fuel.currency,
                        locale,
                      )}
                    </span>
                    <span>
                      {dict.route.fromRoute}:{' '}
                      {formatDistanceMeters(candidate.route.distanceToRouteMeters, locale)}
                    </span>
                    <span>
                      {dict.route.detour}:{' '}
                      {formatDistanceMeters(candidate.route.detourMeters ?? 0, locale)}
                    </span>
                    <span>
                      {dict.route.extraTime}:{' '}
                      {formatDuration(candidate.route.detourDurationSeconds ?? 0)}
                    </span>
                  </div>
                  <div className={styles.savingsDetail}>
                    <span>
                      {dict.route.grossSaving}:{' '}
                      {formatPrice(
                        candidate.savings.grossSaving,
                        candidate.fuel.currency,
                        locale,
                      )}
                    </span>
                    <span>
                      {dict.route.extraDrivingCost}:{' '}
                      {formatPrice(
                        candidate.savings.extraDrivingCost,
                        candidate.fuel.currency,
                        locale,
                      )}
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
