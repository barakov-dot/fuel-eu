'use client';

import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import type { FuelType } from '@/lib/api/types';
import { fuelLabel, splitFuelTypes } from '@/lib/stations/helpers';
import styles from './FuelSelector.module.css';

type FuelSelectorProps = {
  fuelTypes: FuelType[];
  selectedFuelTypeId?: string;
  onChange: (fuelTypeId: string | undefined) => void;
};

export function FuelSelector({
  fuelTypes,
  selectedFuelTypeId,
  onChange,
}: FuelSelectorProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const { prominent, other } = splitFuelTypes(fuelTypes);

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>{dict.filters.fuel}</span>
      <div className={styles.options} role="group" aria-label={dict.filters.fuel}>
        {prominent.map((fuel) => (
          <button
            key={fuel.id}
            type="button"
            className={
              selectedFuelTypeId === fuel.id ? styles.active : styles.option
            }
            aria-pressed={selectedFuelTypeId === fuel.id}
            onClick={() =>
              onChange(selectedFuelTypeId === fuel.id ? undefined : fuel.id)
            }
          >
            {fuelLabel(fuel, locale)}
          </button>
        ))}
      </div>
      {other.length > 0 && (
        <label className={styles.more}>
          <span>{dict.filters.moreFuels}</span>
          <select
            className={styles.select}
            value={
              other.some((fuel) => fuel.id === selectedFuelTypeId)
                ? selectedFuelTypeId
                : ''
            }
            onChange={(event) =>
              onChange(event.target.value || undefined)
            }
          >
            <option value="">—</option>
            {other.map((fuel) => (
              <option key={fuel.id} value={fuel.id}>
                {fuelLabel(fuel, locale)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
