'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import {
  pollReportImageUntilReady,
  uploadReportImage,
  type ReportImageCandidate,
} from '@/lib/api/report-images';
import { createPriceReport } from '@/lib/api/reports';
import type { FuelType } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import styles from './PhotoReportForm.module.css';

type EditableCandidate = ReportImageCandidate & {
  selected: boolean;
  fuelTypeId: string;
  price: string;
};

type PhotoReportFormProps = {
  stationId: string;
  fuelTypes: FuelType[];
  defaultCurrency?: string;
  onSubmitted?: () => void;
  onManualFallback?: () => void;
};

export function PhotoReportForm({
  stationId,
  fuelTypes,
  defaultCurrency = 'EUR',
  onSubmitted,
  onManualFallback,
}: PhotoReportFormProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const { state } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    'idle' | 'uploading' | 'processing' | 'review' | 'submitting' | 'done'
  >('idle');
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fuelByCode = useMemo(() => {
    const map = new Map<string, FuelType>();
    for (const fuel of fuelTypes) {
      map.set(fuel.code.toUpperCase(), fuel);
    }
    return map;
  }, [fuelTypes]);

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

  const resetPreview = () => {
    if (previewUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetPreview();
    setCandidates([]);
    setImageId(null);
    setPhase('idle');
    setError(null);
    setSuccess(null);

    if (file && typeof URL.createObjectURL === 'function') {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    const input = document.getElementById('photo-report-input') as
      | HTMLInputElement
      | null;
    const file = input?.files?.[0];
    if (!file) {
      setError(dict.community.photoSelectRequired);
      return;
    }

    setPhase('uploading');
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadReportImage(stationId, file);
      setImageId(uploaded.id);
      setPhase('processing');
      const processed = await pollReportImageUntilReady(uploaded.id);

      if (processed.status === 'failed' || processed.candidates.length === 0) {
        setPhase('review');
        setCandidates([]);
        return;
      }

      setCandidates(
        processed.candidates.map((candidate) => ({
          ...candidate,
          selected: true,
          fuelTypeId:
            candidate.fuelTypeId ??
            fuelByCode.get(candidate.fuelCodeSuggestion.toUpperCase())?.id ??
            fuelTypes[0]?.id ??
            '',
          price: candidate.price,
        })),
      );
      setPhase('review');
    } catch (uploadError) {
      setPhase('idle');
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : dict.errors.generic,
      );
    }
  };

  const handleConfirmSubmit = async () => {
    const selected = candidates.filter((candidate) => candidate.selected);
    if (selected.length === 0) {
      setError(dict.community.photoSelectCandidate);
      return;
    }

    if (!imageId) {
      setError(dict.community.photoMissingImage);
      return;
    }

    setPhase('submitting');
    setError(null);

    try {
      for (const candidate of selected) {
        if (!candidate.fuelTypeId || !candidate.price.trim()) {
          throw new ApiError(dict.community.photoInvalidCandidate, 400);
        }

        await createPriceReport(stationId, {
          fuelTypeId: candidate.fuelTypeId,
          price: candidate.price.trim(),
          currency: defaultCurrency,
          reportImageId: imageId,
          ocrAssisted: true,
          originalCandidate: {
            fuelCodeSuggestion: candidate.fuelCodeSuggestion,
            rawLabel: candidate.rawLabel,
            price: candidate.price,
            confidence: candidate.confidence,
          },
        });
      }

      setSuccess(dict.community.reportSubmitted);
      setPhase('done');
      onSubmitted?.();
    } catch (submitError) {
      setPhase('review');
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : dict.errors.generic,
      );
    }
  };

  return (
    <div className={styles.form}>
      <h3>{dict.community.photoReportTitle}</h3>
      <p className={styles.hint}>{dict.community.photoTips}</p>

      <label className={styles.field}>
        <span>{dict.community.photoChoose}</span>
        <input
          id="photo-report-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      </label>

      {previewUrl && (
        <img
          src={previewUrl}
          alt={dict.community.photoPreviewAlt}
          className={styles.preview}
        />
      )}

      {phase === 'idle' && (
        <Button type="button" onClick={() => void handleUpload()}>
          {dict.community.photoUpload}
        </Button>
      )}

      {(phase === 'uploading' || phase === 'processing') && (
        <StatusMessage>
          {phase === 'uploading'
            ? dict.community.photoUploading
            : dict.community.photoProcessing}
        </StatusMessage>
      )}

      {phase === 'review' && candidates.length === 0 && (
        <div className={styles.fallback}>
          <StatusMessage variant="error">
            {dict.community.photoNoCandidates}
          </StatusMessage>
          <Button type="button" variant="secondary" onClick={onManualFallback}>
            {dict.community.photoManualFallback}
          </Button>
        </div>
      )}

      {phase === 'review' && candidates.length > 0 && (
        <div className={styles.candidates}>
          <p>{dict.community.photoReviewHint}</p>
          {candidates.map((candidate, index) => (
            <div key={`${candidate.rawLabel}-${index}`} className={styles.candidate}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={candidate.selected}
                  onChange={(event) => {
                    setCandidates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, selected: event.target.checked }
                          : item,
                      ),
                    );
                  }}
                />
                <span>{candidate.rawLabel || candidate.fuelCodeSuggestion}</span>
              </label>
              <label className={styles.field}>
                <span>{dict.filters.fuel}</span>
                <select
                  value={candidate.fuelTypeId}
                  onChange={(event) => {
                    const fuelTypeId = event.target.value;
                    setCandidates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, fuelTypeId } : item,
                      ),
                    );
                  }}
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
                  value={candidate.price}
                  onChange={(event) => {
                    const price = event.target.value;
                    setCandidates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, price } : item,
                      ),
                    );
                  }}
                />
              </label>
            </div>
          ))}
          <Button type="button" onClick={() => void handleConfirmSubmit()}>
            {dict.community.photoConfirmSubmit}
          </Button>
        </div>
      )}

      {phase === 'submitting' && (
        <StatusMessage>{dict.community.submitting}</StatusMessage>
      )}

      {error && <StatusMessage variant="error">{error}</StatusMessage>}
      {success && <StatusMessage>{success}</StatusMessage>}
    </div>
  );
}
