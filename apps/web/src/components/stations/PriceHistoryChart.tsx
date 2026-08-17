'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { fetchStationPriceHistory } from '@/lib/api/stations';
import { ApiError } from '@/lib/api/types';
import type { FuelType } from '@/lib/api/types';
import { historyRangeForPeriod } from '@/lib/geo/location';
import { formatPrice } from '@/lib/format/price';
import styles from './PriceHistoryChart.module.css';

type Period = '24h' | '7d' | '30d' | '90d';

type PriceHistoryChartProps = {
  stationId: string;
  fuelTypes: FuelType[];
  initialFuelTypeId?: string;
};

type ChartPoint = {
  observedAt: string;
  price: number;
  currency: string;
  label: string;
};

export function PriceHistoryChart({
  stationId,
  fuelTypes,
  initialFuelTypeId,
}: PriceHistoryChartProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>('7d');
  const [fuelTypeId, setFuelTypeId] = useState(initialFuelTypeId ?? fuelTypes[0]?.id);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fuelTypeId) {
      return;
    }

    const controller = new AbortController();
    const range = historyRangeForPeriod(period);

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    fetchStationPriceHistory(
      stationId,
      {
        fuelTypeId,
        from: range.from,
        to: range.to,
      },
      controller.signal,
    )
      .then((entries) => {
        setPoints(
          entries.map((entry) => ({
            observedAt: entry.observedAt,
            price: Number(entry.price),
            currency: entry.currencyCode,
            label: new Date(entry.observedAt).toLocaleString(locale),
          })),
        );
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof ApiError
            ? fetchError.message
            : dict.errors.historyUnavailable,
        );
        setPoints([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [dict.errors.historyUnavailable, fuelTypeId, locale, period, stationId]);

  const currency = points[0]?.currency ?? 'EUR';

  const periodLabels: Record<Period, string> = {
    '24h': dict.detail.period24h,
    '7d': dict.detail.period7d,
    '30d': dict.detail.period30d,
    '90d': dict.detail.period90d,
  };

  const yDomain = useMemo(() => {
    if (points.length === 0) {
      return undefined;
    }
    const values = points.map((point) => point.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 0.05);
    return [min - padding, max + padding];
  }, [points]);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>{dict.detail.priceHistory}</h2>
        <div className={styles.controls}>
          <select
            value={fuelTypeId}
            onChange={(event) => setFuelTypeId(event.target.value)}
            aria-label={dict.filters.fuel}
          >
            {fuelTypes.map((fuel) => (
              <option key={fuel.id} value={fuel.id}>
                {fuel.code.toUpperCase()}
              </option>
            ))}
          </select>
          <div className={styles.periods}>
            {(Object.keys(periodLabels) as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                className={item === period ? styles.periodActive : styles.period}
                onClick={() => setPeriod(item)}
              >
                {periodLabels[item]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <StatusMessage>{dict.detail.historyLoading}</StatusMessage>
      )}

      {error && <StatusMessage variant="error">{error}</StatusMessage>}

      {!loading && !error && points.length === 0 && (
        <StatusMessage>{dict.detail.historyEmpty}</StatusMessage>
      )}

      {!loading && !error && points.length > 0 && (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
              <XAxis
                dataKey="observedAt"
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString(locale, {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                minTickGap={24}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(value: number) =>
                  formatPrice(String(value), currency, locale)
                }
                width={72}
              />
              <Tooltip
                formatter={(value) =>
                  formatPrice(String(value ?? ''), currency, locale)
                }
                labelFormatter={(label) =>
                  new Date(String(label)).toLocaleString(locale)
                }
              />
              <Line
                type="linear"
                dataKey="price"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
