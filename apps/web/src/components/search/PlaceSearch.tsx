'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { searchPlaces } from '@/lib/api/geocoding';
import type { GeocodingResult } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import styles from './PlaceSearch.module.css';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 600;

export type PlaceSearchProps = {
  placeholder: string;
  selectedLabel?: string | null;
  biasLocation?: { lat: number; lon: number } | null;
  countryCodes?: string;
  onSelect: (result: GeocodingResult) => void;
  onClear?: () => void;
  inputId?: string;
  listId?: string;
};

function formatResultMeta(result: GeocodingResult): string {
  const parts = [
    result.address.city,
    result.address.country,
  ].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(', ');
  }
  return result.displayName;
}

export function PlaceSearch({
  placeholder,
  selectedLabel,
  biasLocation,
  countryCodes,
  onSelect,
  onClear,
  inputId,
  listId,
}: PlaceSearchProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const generatedId = useId();
  const resolvedInputId = inputId ?? `place-search-${generatedId}`;
  const resolvedListId = listId ?? `place-search-list-${generatedId}`;

  const [query, setQuery] = useState(selectedLabel ?? '');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'searching' | 'results' | 'empty' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setStatus('idle');
        setIsOpen(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      setStatus('searching');
      setErrorMessage(null);
      setIsOpen(true);

      try {
        const response = await searchPlaces(
          {
            q: trimmed,
            limit: 5,
            language: locale,
            lat: biasLocation?.lat,
            lon: biasLocation?.lon,
            countryCodes,
          },
          controller.signal,
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults(response.items);
        setActiveIndex(response.items.length > 0 ? 0 : -1);
        setStatus(response.items.length > 0 ? 'results' : 'empty');
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults([]);
        setActiveIndex(-1);
        setStatus('error');

        if (error instanceof ApiError) {
          if (error.status === 429) {
            setErrorMessage(dict.geocode.rateLimited);
          } else if (error.status === 503) {
            setErrorMessage(dict.geocode.unavailable);
          } else {
            setErrorMessage(error.message);
          }
        } else {
          setErrorMessage(dict.geocode.networkError);
        }
      }
    },
    [biasLocation, countryCodes, dict.geocode, locale],
  );

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        void runSearch(value);
      }, DEBOUNCE_MS);
    },
    [runSearch],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const handleSubmit = () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    void runSearch(query);
  };

  const handleSelect = (result: GeocodingResult) => {
    setQuery(result.displayName);
    setResults([]);
    setIsOpen(false);
    setStatus('idle');
    setActiveIndex(-1);
    onSelect(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setStatus('idle');
    setIsOpen(false);
    setActiveIndex(-1);
    onClear?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
      }
      setActiveIndex((current) =>
        results.length === 0
          ? -1
          : current + 1 >= results.length
            ? 0
            : current + 1,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0
          ? -1
          : current - 1 < 0
            ? results.length - 1
            : current - 1,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen && activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
        return;
      }
      handleSubmit();
    }
  };

  const statusMessage =
    status === 'searching'
      ? dict.geocode.searching
      : status === 'empty'
        ? dict.geocode.noResults
        : status === 'error'
          ? errorMessage
          : null;

  return (
    <div className={styles.placeSearch}>
      <div className={styles.inputRow}>
        <input
          id={resolvedInputId}
          className={styles.input}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={resolvedListId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${resolvedListId}-option-${activeIndex}` : undefined
          }
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            scheduleSearch(nextValue);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.searchButton}
          onClick={handleSubmit}
          disabled={query.trim().length < MIN_QUERY_LENGTH || status === 'searching'}
          aria-label={dict.geocode.searchButton}
        >
          {dict.geocode.searchButton}
        </button>
      </div>

      {selectedLabel && onClear && (
        <button type="button" className={styles.clearButton} onClick={handleClear}>
          {dict.geocode.clearSelection}
        </button>
      )}

      {statusMessage && (
        <p className={styles.status} role="status">
          {statusMessage}
        </p>
      )}

      {isOpen && results.length > 0 && (
        <ul
          id={resolvedListId}
          role="listbox"
          className={styles.results}
          aria-label={dict.geocode.resultsLabel}
        >
          {results.map((result, index) => (
            <li key={result.id} role="presentation">
              <button
                id={`${resolvedListId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex ? styles.resultItemActive : styles.resultItem
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(result)}
              >
                <span className={styles.resultName}>{result.name}</span>
                <span className={styles.resultMeta}>{formatResultMeta(result)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
