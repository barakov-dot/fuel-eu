'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import {
  fetchStationReports,
  voteOnReport,
  type PriceReport,
} from '@/lib/api/reports';
import { ApiError } from '@/lib/api/types';
import { formatPrice } from '@/lib/format/price';
import styles from './CommunityReportsList.module.css';

type CommunityReportsListProps = {
  stationId: string;
  refreshKey?: number;
};

export function CommunityReportsList({
  stationId,
  refreshKey = 0,
}: CommunityReportsListProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const { state } = useAuth();
  const [reports, setReports] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetchStationReports(stationId, { limit: 10 });
        if (!cancelled) {
          setReports(response.items);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : dict.errors.generic,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [dict.errors.generic, stationId, refreshKey]);

  const reloadReports = async () => {
    const response = await fetchStationReports(stationId, { limit: 10 });
    setReports(response.items);
    setError(null);
  };

  const handleVote = async (reportId: string, vote: 'confirm' | 'dispute') => {
    if (state.status === 'anonymous') {
      return;
    }
    try {
      await voteOnReport(reportId, vote);
      await reloadReports();
    } catch (voteError) {
      setError(
        voteError instanceof ApiError ? voteError.message : dict.errors.generic,
      );
    }
  };

  if (loading) {
    return <StatusMessage>{dict.community.loadingReports}</StatusMessage>;
  }

  if (reports.length === 0) {
    return <p className={styles.empty}>{dict.community.noReports}</p>;
  }

  return (
    <div className={styles.list}>
      {error && <StatusMessage variant="error">{error}</StatusMessage>}
      {reports.map((report) => (
        <article key={report.id} className={styles.item}>
          <div className={styles.main}>
            <strong>{report.fuelCode.toUpperCase()}</strong>
            <span>{formatPrice(report.price, report.currency, locale)}</span>
            <span className={styles.meta}>
              {dict.community.confidence}: {Number(report.confidence).toFixed(2)}
            </span>
            <span className={styles.meta}>
              {dict.community.confirmations}: {report.confirmations} ·{' '}
              {dict.community.disputes}: {report.disputes}
            </span>
            {report.evidence?.hasPhoto && (
              <span className={styles.meta}>{dict.community.photoVerified}</span>
            )}
          </div>
          <div className={styles.actions}>
            {state.status === 'anonymous' ? (
              <Link href={`/${locale}/login?returnTo=/${locale}/stations/${stationId}`}>
                {dict.community.loginToVote}
              </Link>
            ) : report.isAuthor ? (
              <span className={styles.meta}>{dict.community.ownReport}</span>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void handleVote(report.id, 'confirm')}
                >
                  {dict.community.confirm}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleVote(report.id, 'dispute')}
                >
                  {dict.community.dispute}
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function sourceBadgeLabel(
  sourceType: string,
  dict: ReturnType<typeof useDictionary>,
  verification?: { confirmations: number; disputes: number },
  sourceName?: string,
): string {
  if (sourceType === 'crowdsourced') {
    const confirms = verification?.confirmations ?? 0;
    return confirms > 0
      ? `${dict.community.badgeCommunity} · ${confirms} ${dict.community.confirmations.toLowerCase()}`
      : dict.community.badgeCommunity;
  }
  if (sourceType === 'official') {
    return dict.community.badgeOfficial;
  }
  if (sourceType === 'commercial' || sourceType === 'fuel_chain') {
    return dict.community.badgeCommercial;
  }
  if (sourceType === 'third_party' && sourceName) {
    return sourceName;
  }
  return sourceType;
}

export { sourceBadgeLabel };
