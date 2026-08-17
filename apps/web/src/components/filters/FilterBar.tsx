'use client';

import { useDictionary } from '@/components/i18n/I18nProvider';
import { t } from '@/lib/i18n/dictionaries';
import type { NearbySort } from '@/lib/api/types';
import styles from './FilterBar.module.css';

type FilterBarProps = {
  radiusKm: number;
  sort: NearbySort;
  onRadiusChange: (radiusKm: number) => void;
  onSortChange: (sort: NearbySort) => void;
  fuelSelected: boolean;
};

const RADIUS_OPTIONS = [5, 10, 20, 50];

export function FilterBar({
  radiusKm,
  sort,
  onRadiusChange,
  onSortChange,
  fuelSelected,
}: FilterBarProps) {
  const dict = useDictionary();

  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span>{dict.filters.radius}</span>
        <select
          value={radiusKm}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        >
          {RADIUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t(dict.filters.km, { value })}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>{dict.filters.sort}</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as NearbySort)}
        >
          <option value="distance">{dict.filters.sortDistance}</option>
          <option value="price" disabled={!fuelSelected}>
            {dict.filters.sortPrice}
          </option>
        </select>
      </label>
    </div>
  );
}
