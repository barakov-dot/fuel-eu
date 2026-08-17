'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { fetchFavorites } from '@/lib/api/favorites';
import { fetchFuelTypes } from '@/lib/api/fuels';
import { patchPreferences } from '@/lib/api/auth';
import { fetchMyReports, fetchMyReputation, type MyPriceReport, type ReputationSummary } from '@/lib/api/reports';
import type { FavoriteStationSummary, FuelType } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/config';
import { fuelLabel } from '@/lib/stations/helpers';
import { ApiError } from '@/lib/api/types';
import formStyles from '@/components/auth/AuthForm.module.css';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

type PreferenceDraft = {
  preferredFuelTypeId?: string;
  preferredCurrency?: string;
  defaultRefuelLiters?: string;
  vehicleConsumption?: string;
  preferredLocale?: Locale;
};

export function AccountPage() {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const { state, logout, refresh } = useAuth();
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [favorites, setFavorites] = useState<FavoriteStationSummary[]>([]);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [myReports, setMyReports] = useState<MyPriceReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preferences =
    state.status === 'authenticated' ? state.preferences : null;

  const [draft, setDraft] = useState<PreferenceDraft>({});

  const preferredFuelTypeId =
    draft.preferredFuelTypeId ?? preferences?.preferredFuelTypeId ?? '';
  const preferredCurrency =
    draft.preferredCurrency ?? preferences?.preferredCurrency ?? 'EUR';
  const defaultRefuelLiters =
    draft.defaultRefuelLiters ?? preferences?.defaultRefuelLiters ?? '';
  const vehicleConsumption =
    draft.vehicleConsumption ??
    preferences?.vehicleConsumptionLPer100Km ??
    '';
  const preferredLocale =
    draft.preferredLocale ??
    (preferences?.locale === 'ru' ? 'ru' : 'en');

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace(`/${locale}/login?returnTo=/${locale}/account`);
    }
  }, [state.status, locale, router]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchFuelTypes(controller.signal),
      fetchFavorites(controller.signal),
      fetchMyReputation(controller.signal),
      fetchMyReports(10, controller.signal),
    ])
      .then(([fuels, favoriteResponse, reputationResponse, reportsResponse]) => {
        setFuelTypes(fuels);
        setFavorites(favoriteResponse.items);
        setReputation(reputationResponse);
        setMyReports(reportsResponse.items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (state.status === 'loading' || state.status === 'anonymous') {
    return <StatusMessage>{dict.auth.loading}</StatusMessage>;
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await patchPreferences({
        preferredFuelTypeId: preferredFuelTypeId || null,
        preferredCurrency: preferredCurrency || null,
        defaultRefuelLiters: defaultRefuelLiters || null,
        vehicleConsumptionLPer100Km: vehicleConsumption || null,
        locale: preferredLocale,
      });
      await refresh();
      setDraft({});
      setMessage(dict.auth.preferencesSaved);
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : dict.errors.generic,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}`);
  };

  return (
    <div className={formStyles.page}>
      <header className={formStyles.header}>
        <div>
          <Link href={`/${locale}`} className={formStyles.subtle}>
            ← {dict.nav.back}
          </Link>
          <h1 className={formStyles.title}>{dict.auth.accountTitle}</h1>
          <p className={formStyles.subtle}>{state.user.email}</p>
        </div>
        <div>
          <AccountMenu />
          <LanguageSelector />
        </div>
      </header>

      <section className={formStyles.section}>
        <h2>{dict.auth.profileSection}</h2>
        <label className={formStyles.field}>
          <span>{dict.auth.displayNameOptional}</span>
          <input value={state.user.displayName ?? ''} disabled />
        </label>
        <label className={formStyles.field}>
          <span>{dict.auth.preferredFuel}</span>
          <select
            value={preferredFuelTypeId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                preferredFuelTypeId: event.target.value,
              }))
            }
          >
            <option value="">{dict.auth.notSet}</option>
            {fuelTypes.map((fuel) => (
              <option key={fuel.id} value={fuel.id}>
                {fuelLabel(fuel, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className={formStyles.field}>
          <span>{dict.auth.preferredCurrency}</span>
          <select
            value={preferredCurrency}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                preferredCurrency: event.target.value,
              }))
            }
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label className={formStyles.field}>
          <span>{dict.route.refuelLiters}</span>
          <input
            inputMode="decimal"
            value={defaultRefuelLiters}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                defaultRefuelLiters: event.target.value,
              }))
            }
          />
        </label>
        <label className={formStyles.field}>
          <span>{dict.route.consumption}</span>
          <input
            inputMode="decimal"
            value={vehicleConsumption}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                vehicleConsumption: event.target.value,
              }))
            }
          />
        </label>
        <label className={formStyles.field}>
          <span>{dict.language.label}</span>
          <select
            value={preferredLocale}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                preferredLocale: event.target.value === 'ru' ? 'ru' : 'en',
              }))
            }
          >
            <option value="en">{dict.language.en}</option>
            <option value="ru">{dict.language.ru}</option>
          </select>
        </label>
        {message && <StatusMessage>{message}</StatusMessage>}
        {error && <StatusMessage variant="error">{error}</StatusMessage>}
        <div className={formStyles.actions}>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? dict.auth.saving : dict.auth.savePreferences}
          </Button>
          <Button variant="secondary" onClick={() => void handleLogout()}>
            {dict.auth.logout}
          </Button>
        </div>
      </section>

      <section className={formStyles.section}>
        <h2>{dict.community.reputationTitle}</h2>
        {reputation ? (
          <ul className={formStyles.favoritesList}>
            <li className={formStyles.favoriteItem}>
              {dict.community.reputationScore}: {reputation.score}
            </li>
            <li className={formStyles.favoriteItem}>
              {dict.community.reportsSubmitted}: {reputation.acceptedReportsCount}
            </li>
            <li className={formStyles.favoriteItem}>
              {dict.community.reportsConfirmed}: {reputation.confirmedReportsCount}
            </li>
            <li className={formStyles.favoriteItem}>
              {dict.community.reportsRejected}: {reputation.rejectedReportsCount}
            </li>
          </ul>
        ) : (
          <p className={formStyles.subtle}>{dict.auth.loading}</p>
        )}
        {myReports.length > 0 && (
          <div className={formStyles.favoritesList}>
            {myReports.map((report) => (
              <Link
                key={report.id}
                href={`/${locale}/stations/${report.station.id}`}
                className={formStyles.favoriteItem}
              >
                <div className={formStyles.favoriteTitle}>
                  {report.station.name ?? report.station.brand ?? dict.stations.unknownName}
                </div>
                <div className={formStyles.favoriteMeta}>
                  {report.fuelCode.toUpperCase()} · {report.price} {report.currency} · {report.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={formStyles.section}>
        <h2>{dict.auth.favoritesTitle}</h2>
        {favorites.length === 0 ? (
          <p className={formStyles.subtle}>{dict.auth.noFavorites}</p>
        ) : (
          <div className={formStyles.favoritesList}>
            {favorites.map((favorite) => (
              <Link
                key={favorite.id}
                href={`/${locale}/stations/${favorite.id}`}
                className={formStyles.favoriteItem}
              >
                <div className={formStyles.favoriteTitle}>
                  {favorite.name ?? favorite.brand ?? dict.stations.unknownName}
                </div>
                <div className={formStyles.favoriteMeta}>
                  {[favorite.address.city, favorite.address.addressLine]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
