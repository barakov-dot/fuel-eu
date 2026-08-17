'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { createPriceReport } from '@/lib/api/reports';
import type { FuelType } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import styles from './ReportPriceForm.module.css';

type ReportPriceFormProps = {
  stationId: string;
  fuelTypes: FuelType[];
  defaultCurrency?: string;
  onSubmitted?: () => void;
};

export function ReportPriceForm({
  stationId,
  fuelTypes,
  defaultCurrency = 'EUR',
  onSubmitted,
}: ReportPriceFormProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const { state } = useAuth();

  const [fuelTypeId, setFuelTypeId] = useState(fuelTypes[0]?.id ?? '');
  const [price, setPrice] = useState('');
  const [currency] = useState(defaultCurrency);
  const [useLocation, setUseLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (state.status === 'anonymous') {
    return (
      <div className={styles.anonymous}>
        <p>{dict.community.loginToReport}</p>
        <Link href={`/${locale}/login?returnTo=/${locale}/stations/${stationId}`}>
          {dict.auth.login}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let location: { lat: number; lon: number } | undefined;

      if (useLocation && navigator.geolocation) {
        location = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) =>
              resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              }),
            reject,
            { enableHighAccuracy: true, timeout: 10000 },
          );
        });
      }

      await createPriceReport(stationId, {
        fuelTypeId,
        price: price.trim(),
        currency,
        location,
      });

      setSuccess(dict.community.reportSubmitted);
      setPrice('');
      onSubmitted?.();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : dict.errors.generic,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <h3>{dict.community.reportPrice}</h3>
      <label className={styles.field}>
        <span>{dict.filters.fuel}</span>
        <select
          value={fuelTypeId}
          onChange={(event) => setFuelTypeId(event.target.value)}
          required
        >
          {fuelTypes.map((fuel) => (
            <option key={fuel.id} value={fuel.id}>
              {fuel.code.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>{dict.community.priceLabel}</span>
        <input
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="1.689"
          required
        />
      </label>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={useLocation}
          onChange={(event) => setUseLocation(event.target.checked)}
        />
        <span>{dict.community.verifyLocation}</span>
      </label>
      <p className={styles.hint}>{dict.community.locationHint}</p>
      {error && <StatusMessage variant="error">{error}</StatusMessage>}
      {success && <StatusMessage>{success}</StatusMessage>}
      <Button type="submit" disabled={submitting || !fuelTypeId || !price}>
        {submitting ? dict.community.submitting : dict.community.submitReport}
      </Button>
    </form>
  );
}
