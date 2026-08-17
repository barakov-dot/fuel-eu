'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDictionary, useLocale } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { registerAccount } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/types';
import styles from './AuthForm.module.css';

type RegisterFormProps = {
  returnTo?: string | null;
};

function isSafeReturnPath(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export function RegisterForm({ returnTo }: RegisterFormProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const { setAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await registerAccount({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      setAuthenticated(response);
      const destination = isSafeReturnPath(returnTo ?? null)
        ? returnTo!
        : `/${locale}/account`;
      router.push(destination);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : dict.errors.generic,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>{dict.auth.email}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>{dict.auth.password}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>{dict.auth.displayNameOptional}</span>
        <input
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      {error && <StatusMessage variant="error">{error}</StatusMessage>}
      <Button type="submit" disabled={loading}>
        {loading ? dict.auth.creatingAccount : dict.auth.createAccount}
      </Button>
    </form>
  );
}
