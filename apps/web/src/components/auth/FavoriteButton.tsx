'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import styles from './FavoriteButton.module.css';

type FavoriteButtonProps = {
  stationId: string;
  compact?: boolean;
};

export function FavoriteButton({ stationId, compact }: FavoriteButtonProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const { state, isFavorite, toggleFavorite } = useAuth();
  const [loading, setLoading] = useState(false);

  const favorite = isFavorite(stationId);

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (state.status !== 'authenticated') {
      router.push(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}`)}`);
      return;
    }

    setLoading(true);
    try {
      await toggleFavorite(stationId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      className={compact ? styles.compact : styles.button}
      disabled={loading}
      aria-pressed={favorite}
      onClick={(event) => void handleClick(event)}
    >
      {favorite ? dict.auth.unfavorite : dict.auth.favorite}
    </Button>
  );
}
